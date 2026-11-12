import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { z } from 'zod';

export const MAX_HOTEL_STAY_NIGHTS = 90;
export const HOTEL_RESERVATION_TRANSITIONS: Record<
  RequestStatus,
  readonly RequestStatus[]
> = {
  new: [
    'pending',
    'requires_more_info',
    'accepted',
    'refused',
    'cancelled',
    'expired',
  ],
  pending: [
    'requires_more_info',
    'accepted',
    'refused',
    'cancelled',
    'expired',
  ],
  requires_more_info: [
    'pending',
    'accepted',
    'refused',
    'cancelled',
    'expired',
  ],
  accepted: ['refused', 'cancelled', 'completed'],
  refused: [],
  cancelled: [],
  expired: [],
  completed: [],
};
export const HOTEL_STOCK_MESSAGES = {
  on_request:
    'Stock renseigné, sous réserve de confirmation par l’établissement.',
  availability_unknown:
    'Disponibilité à confirmer : certaines dates ne sont pas renseignées ou sont périmées.',
  stock_insufficient: 'Le stock restant ne couvre pas cette demande.',
  stop_sell: 'Les demandes sont suspendues sur cette période.',
  stay_restriction: 'Ce séjour ne respecte pas les durées autorisées.',
  calendar_closed: 'Cette période est fermée, complète ou en maintenance.',
  external_confirmation_required:
    'La confirmation doit être effectuée dans le logiciel hôtelier ; elle n’est pas disponible sur Péncmi.',
  room_inventory_incomplete:
    'Le stock de cette catégorie doit être renseigné avant confirmation.',
  legacy_request:
    'Demande historique incomplète : aucune confirmation de stock ne peut être garantie.',
  legacy_stock_unreconciled:
    'Des séjours acceptés sans allocations fiables doivent être rapprochés avant toute nouvelle confirmation.',
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'Date invalide.');
export const hotelStaySchema = z
  .object({
    roomId: z.string().min(1).max(100),
    checkIn: dateSchema,
    checkOut: dateSchema,
    guests: z.number().int().min(1).max(100),
    units: z.number().int().min(1).max(10),
  })
  .strict();
export const hotelRequestSchema = hotelStaySchema
  .extend({
    requestId: z.string().uuid(),
    clientName: z.string().trim().min(2).max(120),
    clientPhone: z.string().max(30).optional(),
    clientEmail: z.string().trim().toLowerCase().email().max(254).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .strict();
export type HotelStay = z.infer<typeof hotelStaySchema>;
export const activeHotelAllocations = {
  where: { releasedAt: null },
  select: { date: true, units: true, channelAckedAt: true },
} as const;
/** What the stock of a room needs from the synchronisation with the hotel software. */
export const hotelSyncRoomInclude = {
  icalImports: { where: { active: true }, select: { lastSuccessAt: true } },
  externalBlocks: { select: { date: true, units: true } },
} as const;
/** An iCal calendar older than this no longer opens nights by itself. */
export const HOTEL_ICAL_FRESHNESS_MS = 3 * 3600_000;
export type HotelSyncMode = 'none' | 'ical' | 'channel_manager';

/** Only an active integration claiming the external software confirms outside Pencmi. */
export function hotelConfirmedExternally(integration: any) {
  return (
    integration?.status === 'active' &&
    integration.sourceOfTruth === 'external_system'
  );
}
export function hotelSyncMode(integration: any): HotelSyncMode {
  return integration?.status === 'active' &&
    ['ical', 'channel_manager'].includes(integration.syncMode)
    ? integration.syncMode
    : 'none';
}
/** Every active calendar of the room was read successfully a short while ago. */
export function hotelIcalFresh(room: any, now = new Date()) {
  const imports = room.icalImports || [];
  return (
    imports.length > 0 &&
    imports.every(
      (entry: any) =>
        entry.lastSuccessAt &&
        now.valueOf() - new Date(entry.lastSuccessAt).valueOf() <
          HOTEL_ICAL_FRESHNESS_MS,
    )
  );
}
/** Units occupied on that night in the hotel software, read from its calendars. */
export function hotelExternallyBlockedOn(room: any, day: string): number {
  return (room.externalBlocks || [])
    .filter((block: any) => hotelDate(block.date) === day)
    .reduce((sum: number, block: any) => sum + block.units, 0);
}

export function parseHotelInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      message: 'Vérifiez votre demande.',
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  return result.data;
}
export function hotelToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join('-');
}
export const hotelDate = (value: Date | string) =>
  new Date(value).toISOString().slice(0, 10);
export function hotelStayNights(
  checkIn: string,
  checkOut: string,
  allowPast = false,
  now = new Date(),
) {
  if (
    !dateSchema.safeParse(checkIn).success ||
    !dateSchema.safeParse(checkOut).success
  )
    throw new BadRequestException('Dates du séjour invalides.');
  const from = Date.parse(`${checkIn}T00:00:00Z`);
  const nights = (Date.parse(`${checkOut}T00:00:00Z`) - from) / 86400000;
  if (nights < 1 || nights > MAX_HOTEL_STAY_NIGHTS)
    throw new BadRequestException(
      `Le départ doit suivre l’arrivée, pour un séjour de ${MAX_HOTEL_STAY_NIGHTS} nuits maximum.`,
    );
  if (!allowPast && checkIn < hotelToday(now))
    throw new BadRequestException('La date d’arrivée ne peut pas être passée.');
  return Array.from({ length: nights }, (_, index) =>
    new Date(from + index * 86400000).toISOString().slice(0, 10),
  );
}
/**
 * Units Pencmi reserved on that night. With a channel manager, the availability it sent
 * after acknowledging a reservation already deducts it: only the others are counted.
 */
export function hotelReservedOn(
  room: any,
  day: string,
  dayRow?: any,
  integration?: any,
): number {
  const sentAt =
    hotelSyncMode(integration) === 'channel_manager' && dayRow?.updatedAt
      ? new Date(dayRow.updatedAt).valueOf()
      : null;
  return (room.stockAllocations || [])
    .filter(
      (allocation: any) =>
        !allocation.releasedAt &&
        hotelDate(allocation.date) === day &&
        !(
          sentAt !== null &&
          allocation.channelAckedAt &&
          new Date(allocation.channelAckedAt).valueOf() <= sentAt
        ),
    )
    .reduce((sum: number, allocation: any) => sum + allocation.units, 0);
}

export function hotelStayQuote(
  room: any,
  stay: HotelStay,
  integration?: any,
  allowPast = false,
) {
  const nights = hotelStayNights(stay.checkIn, stay.checkOut, allowPast);
  if (!room.capacity || stay.guests > room.capacity * stay.units)
    throw new BadRequestException(
      'Le nombre de voyageurs dépasse la capacité des unités demandées.',
    );
  const metadata = room.metadata || {};
  const external = hotelConfirmedExternally(integration);
  const mode = hotelSyncMode(integration);
  // The channel manager sends the sellable stock itself: the declared total does not bound it.
  const channel = mode === 'channel_manager';
  // A fresh calendar lists every occupied night: the others are open on the whole stock.
  const calendarOpen = mode === 'ical' && hotelIcalFresh(room);
  let reason: keyof typeof HOTEL_STOCK_MESSAGES = 'on_request';
  let unknown = false;
  let inventoryInvalid =
    !channel &&
    (!Number.isInteger(metadata.totalUnits) || metadata.totalUnits < stay.units);
  let remaining = Number.MAX_SAFE_INTEGER;
  let estimatedTotal = 0;
  let pricesKnown = true;
  for (const night of nights) {
    const day =
      room.availability.find((entry: any) => hotelDate(entry.date) === night) ??
      (calendarOpen && Number.isInteger(metadata.totalUnits)
        ? { status: 'open', available: metadata.totalUnits, reliableUntil: null }
        : undefined);
    const restriction = room.restrictions.find(
      (entry: any) => hotelDate(entry.date) === night,
    );
    if (restriction?.stopSell) reason = 'stop_sell';
    else if (
      (restriction?.minStay && nights.length < restriction.minStay) ||
      (restriction?.maxStay && nights.length > restriction.maxStay)
    )
      reason = 'stay_restriction';
    const reliable =
      day && (!day.reliableUntil || new Date(day.reliableUntil) > new Date());
    if (!reliable) unknown = true;
    else if (day.status !== 'open' || day.available === 0)
      reason = 'calendar_closed';
    else if (
      !external &&
      (!Number.isInteger(day.available) ||
        day.available < 0 ||
        (!channel && day.available > metadata.totalUnits))
    ) {
      inventoryInvalid = true;
    } else if (!external) {
      const stock =
        day.available -
        hotelReservedOn(room, night, day, integration) -
        hotelExternallyBlockedOn(room, night);
      remaining = Math.min(remaining, stock);
      if (stock < stay.units) reason = 'stock_insufficient';
    }
    const rates = room.rates.filter(
      (rate: any) => hotelDate(rate.date) === night,
    );
    // With a channel manager, the rates it sends replace the ones typed in Pencmi.
    const plan = channel ? 'channel' : 'manual';
    const manual = rates.find((rate: any) => rate.ratePlan === plan);
    const price =
      manual?.currency === 'FCFA'
        ? manual.price
        : !(channel ? rates.filter((rate: any) => rate.ratePlan === plan) : rates).length
          ? metadata.basePrice
          : undefined;
    if (!Number.isSafeInteger(price) || price < 0) pricesKnown = false;
    else estimatedTotal += price * stay.units;
  }
  const unavailable = reason !== 'on_request';
  if (!unavailable) {
    if (external) reason = 'external_confirmation_required';
    else if (inventoryInvalid) reason = 'room_inventory_incomplete';
    else if (unknown) reason = 'availability_unknown';
  }
  return {
    roomId: room.id,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: nights.length,
    units: stay.units,
    guests: stay.guests,
    status: unavailable
      ? 'unavailable'
      : reason === 'on_request'
        ? 'on_request'
        : 'unconfirmed',
    reason,
    message: HOTEL_STOCK_MESSAGES[reason],
    canConfirm: reason === 'on_request',
    remainingUnits:
      !external &&
      !unknown &&
      !inventoryInvalid &&
      remaining !== Number.MAX_SAFE_INTEGER
        ? Math.max(0, remaining)
        : null,
    estimatedTotal: pricesKnown ? estimatedTotal : null,
    currency: 'FCFA' as const,
  };
}

/**
 * A synchronised hotel can let Pencmi accept a request by itself when the stock read from
 * its software covers the stay: the reservation then reaches that software on its own.
 */
export function hotelCanAutoConfirm(
  integration: any,
  room: any,
  quote: { canConfirm: boolean },
  now = new Date(),
) {
  const mode = hotelSyncMode(integration);
  if (!integration?.autoConfirm || mode === 'none' || !quote.canConfirm)
    return false;
  return mode === 'channel_manager' || hotelIcalFresh(room, now);
}

export const MAX_HOTEL_STAY_UNITS = 10;
export const MAX_HOTEL_SEARCH_PROPERTIES = 500;
export type HotelStaySearch = {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

/**
 * Best stay a property can offer for a search, or null when no active room
 * can host it. A room whose calendar is not filled in is kept as
 * "unconfirmed": the establishment still has to confirm it.
 */
export function hotelSearchStay(property: any, search: HotelStaySearch) {
  const quotes = (property.rooms || [])
    .filter((room: any) => room.status === 'active' && room.capacity > 0)
    .map((room: any) => {
      // Enough units of this category to host every guest.
      const units = Math.max(
        search.rooms,
        Math.ceil(search.guests / room.capacity),
      );
      if (units > MAX_HOTEL_STAY_UNITS) return null;
      return hotelStayQuote(
        room,
        {
          roomId: room.id,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          guests: search.guests,
          units,
        },
        property.integration,
      );
    })
    .filter((quote: any) => quote && quote.status !== 'unavailable');
  if (!quotes.length) return null;
  const rank = (quote: any) => (quote.status === 'on_request' ? 0 : 1);
  const total = (quote: any) => quote.estimatedTotal ?? Number.MAX_SAFE_INTEGER;
  return quotes.sort(
    (a: any, b: any) => rank(a) - rank(b) || total(a) - total(b),
  )[0];
}

export type HotelPublicFilters = {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  stars?: number;
  amenity?: string;
};

// Accents, case and punctuation are ignored: "Wi-Fi" matches "wifi".
const hotelSearchText = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function hasHotelPublicFilters(filters: HotelPublicFilters) {
  return Boolean(
    hotelSearchText(filters.query) ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.stars ||
    hotelSearchText(filters.amenity),
  );
}

/**
 * Filters applied to the public form of a property. Price, stars and
 * amenities live in the publication settings, so they cannot be filtered in
 * SQL. A property without a known price is kept by a maximum budget (its
 * price is "to be confirmed") but not by a minimum one.
 */
export function hotelMatchesPublicFilters(
  property: any,
  filters: HotelPublicFilters,
) {
  const metadata = property.metadata || {};
  const query = hotelSearchText(filters.query);
  if (
    query &&
    !hotelSearchText(
      [
        property.name,
        property.propertyType,
        property.city,
        property.region,
        property.description,
      ].join(' '),
    ).includes(query)
  )
    return false;
  const price = Number.isFinite(metadata.nightlyPrice)
    ? metadata.nightlyPrice
    : null;
  if (filters.minPrice && (price === null || price < filters.minPrice))
    return false;
  if (filters.maxPrice && price !== null && price > filters.maxPrice)
    return false;
  if (filters.stars && !(Number(metadata.stars) >= filters.stars)) return false;
  const amenity = hotelSearchText(filters.amenity).replace(/ /g, '');
  if (
    amenity &&
    !(Array.isArray(metadata.amenities) ? metadata.amenities : []).some(
      (item: unknown) => hotelSearchText(item).replace(/ /g, '') === amenity,
    )
  )
    return false;
  return true;
}

export async function assertHotelAllocatedInventory(
  tx: Prisma.TransactionClient,
  room: any,
  input: any,
) {
  const allocations = await tx.hotelStockAllocation.findMany({
    where: { roomId: room.id, releasedAt: null },
    include: { request: { select: { guests: true, units: true } } },
  });
  const future = allocations.filter(
    (allocation) => hotelDate(allocation.date) >= hotelToday(),
  );
  if (
    input.remove &&
    (await tx.hotelReservationRequest.count({ where: { roomId: room.id } }))
  )
    throw new ConflictException(
      'Cette catégorie possède des demandes. Désactivez-la au lieu de la supprimer.',
    );
  if (!future.length) return;
  if (input.enabled === false || input.remove)
    throw new ConflictException(
      'Cette catégorie possède des séjours confirmés à venir.',
    );
  const currentMetadata = room.metadata || {};
  const quantity = input.totalUnits ?? currentMetadata.totalUnits;
  const capacity = input.capacity ?? room.capacity;
  if (
    future.some(
      (allocation) =>
        !quantity ||
        !capacity ||
        (allocation.request.guests || 0) >
          capacity * (allocation.request.units || 1),
    )
  )
    throw new ConflictException(
      'La capacité ne couvre pas les séjours déjà confirmés.',
    );
  const calendar = new Map<string, any>();
  if (input.calendar === undefined)
    room.availability.forEach((day: any) =>
      calendar.set(hotelDate(day.date), day),
    );
  else
    for (const period of input.calendar) {
      if (!period.start || !period.end) continue;
      const start = Date.parse(period.start);
      const end = Date.parse(period.end);
      for (
        let date = start;
        date <= end && date - start <= 365 * 86400000;
        date += 86400000
      )
        calendar.set(hotelDate(new Date(date)), period);
    }
  const totals = new Map<string, number>();
  future.forEach((allocation) => {
    const day = hotelDate(allocation.date);
    totals.set(day, (totals.get(day) || 0) + allocation.units);
  });
  for (const [day, reserved] of totals) {
    const entry = calendar.get(day);
    if (
      !entry ||
      entry.status !== 'open' ||
      entry.available < reserved ||
      quantity < reserved ||
      entry.available > quantity ||
      (entry.reliableUntil && new Date(entry.reliableUntil) <= new Date())
    )
      throw new ConflictException(
        'Ce calendrier ne couvre pas les allocations déjà confirmées. Conservez le stock initial et suspendez les nouvelles demandes si nécessaire.',
      );
  }
}
