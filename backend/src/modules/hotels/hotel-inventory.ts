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
  select: { date: true, units: true },
} as const;

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
export function hotelReservedOn(room: any, day: string): number {
  return (room.stockAllocations || [])
    .filter(
      (allocation: any) =>
        !allocation.releasedAt && hotelDate(allocation.date) === day,
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
  const external = integration?.sourceOfTruth === 'external_system';
  let reason: keyof typeof HOTEL_STOCK_MESSAGES = 'on_request';
  let unknown = false;
  let inventoryInvalid =
    !Number.isInteger(metadata.totalUnits) || metadata.totalUnits < stay.units;
  let remaining = Number.MAX_SAFE_INTEGER;
  let estimatedTotal = 0;
  let pricesKnown = true;
  for (const night of nights) {
    const day = room.availability.find(
      (entry: any) => hotelDate(entry.date) === night,
    );
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
        day.available > metadata.totalUnits)
    ) {
      inventoryInvalid = true;
    } else if (!external) {
      const stock = day.available - hotelReservedOn(room, night);
      remaining = Math.min(remaining, stock);
      if (stock < stay.units) reason = 'stock_insufficient';
    }
    const rates = room.rates.filter(
      (rate: any) => hotelDate(rate.date) === night,
    );
    const manual = rates.find((rate: any) => rate.ratePlan === 'manual');
    const price =
      manual?.currency === 'FCFA'
        ? manual.price
        : !rates.length
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
