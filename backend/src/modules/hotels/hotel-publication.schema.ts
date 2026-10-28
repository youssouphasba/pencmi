import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const HOTEL_PHOTO_LIMIT = 30;
export const HOTEL_OWNER_PHOTO_QUOTA = 150 * 1024 * 1024;
const text = (max = 200) => z.string().trim().max(max);
const integer = (max = 10000) => z.number().int().min(0).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Date invalide.');
const period = {
  start: date.or(z.literal('')).default(''),
  end: date.or(z.literal('')).default(''),
};
const rate = z
  .object({
    ...period,
    price: integer(2147483647).optional(),
    currency: z.literal('FCFA'),
  })
  .strict();
const availability = z
  .object({
    ...period,
    available: integer(),
    status: z.enum(['open', 'closed', 'full', 'maintenance']),
    stopSell: z.boolean(),
    minStay: integer(365).optional(),
    maxStay: integer(365).optional(),
  })
  .strict();
const room = z
  .object({
    id: text(100).optional(),
    clientId: z.string().uuid().optional(),
    name: text(),
    roomType: text().optional(),
    capacity: integer().optional(),
    adults: integer().optional(),
    children: integer().optional(),
    beds: integer().optional(),
    bedType: text().optional(),
    totalUnits: integer().optional(),
    amenities: z.array(text()).max(50).optional(),
    basePrice: integer(2147483647).optional(),
    currency: z.literal('FCFA').default('FCFA'),
    enabled: z.boolean().default(true),
    remove: z.boolean().optional(),
    rates: z.array(rate).max(366).optional(),
    calendar: z.array(availability).max(366).optional(),
  })
  .strict();
const contacts = z
  .object({
    whatsappEnabled: z.boolean().optional(),
    phoneEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    internalMessagingEnabled: z.boolean().optional(),
    contactFormEnabled: z.boolean().optional(),
    reservationRequestEnabled: z.boolean().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
    whatsappNumber: text(30).optional(),
    phoneNumber: text(30).optional(),
    contactEmail: text(254).optional(),
    notificationEmail: text(254).optional(),
  })
  .strict();
export const hotelPublicationSchema = z
  .object({
    name: text().optional(),
    propertyType: z
      .enum([
        'hotel',
        'auberge',
        'residence',
        'appartement_meuble',
        'maison_hotes',
        'villa',
        'campement',
        'chambre_habitant',
      ])
      .optional(),
    city: text().optional(),
    region: text().optional(),
    address: text(500).optional(),
    description: text(10000).optional(),
    metadata: z
      .object({
        general: z
          .object({
            stars: integer(5).optional(),
            totalRooms: integer().optional(),
            checkInTime: text(5)
              .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
              .optional(),
            checkOutTime: text(5)
              .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/)
              .optional(),
          })
          .strict()
          .optional(),
        location: z
          .object({
            district: text().optional(),
            approximate: z.boolean().optional(),
            hideExactAddress: z.boolean().optional(),
          })
          .strict()
          .optional(),
        amenities: z.array(text()).max(50).optional(),
        conditions: z
          .object({
            options: z.array(text()).max(30).optional(),
            additionalFees: text(2000).optional(),
          })
          .strict()
          .optional(),
        management: z
          .object({
            mode: z.literal('manual'),
            showRemainingRoomsToClients: z.boolean().optional(),
          })
          .strict()
          .optional(),
        contactPreferences: contacts.optional(),
      })
      .strict()
      .optional(),
    rooms: z.array(room).max(100).optional(),
  })
  .strict();
export type HotelPublication = z.infer<typeof hotelPublicationSchema>;

export function hotelValidationError(
  fields: { path: string; message: string }[],
): never {
  throw new BadRequestException({
    message: 'Vérifiez les informations de l’hébergement.',
    fields,
  });
}

export function validateHotelPublication(
  value: unknown,
  submitting = false,
): HotelPublication {
  const parsed = hotelPublicationSchema.safeParse(value);
  if (!parsed.success)
    hotelValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  const data = parsed.data;
  const errors: { path: string; message: string }[] = [];
  const identifiers = new Set<string>();
  let expandedDays = 0;
  data.rooms?.forEach((item, index) => {
    const root = `rooms.${index}`;
    const identifier = item.id || item.clientId;
    if (!identifier || identifiers.has(identifier))
      errors.push({
        path: `${root}.name`,
        message: 'Identifiant de chambre absent ou dupliqué.',
      });
    if (identifier) identifiers.add(identifier);
    if (
      item.capacity !== undefined &&
      (item.adults ?? 0) + (item.children ?? 0) > item.capacity
    )
      errors.push({
        path: `${root}.capacity`,
        message: 'La capacité doit couvrir les adultes et les enfants.',
      });
    for (const key of ['rates', 'calendar'] as const) {
      const days = new Set<string>();
      item[key]?.forEach((entry, periodIndex) => {
        if (!entry.start || !entry.end) return;
        const length =
          (Date.parse(entry.end) - Date.parse(entry.start)) / 86400000;
        expandedDays += length + 1;
        if (length < 0 || length > 365)
          errors.push({
            path: `${root}.${key}.${periodIndex}.end`,
            message: 'Période invalide ou supérieure à 366 jours.',
          });
        else
          for (const day of hotelPeriodDays(entry.start, entry.end)) {
            if (days.has(day))
              errors.push({
                path: `${root}.${key}.${periodIndex}.start`,
                message: 'Les périodes ne doivent pas se chevaucher.',
              });
            days.add(day);
          }
      });
    }
    item.calendar?.forEach((entry, i) => {
      if (
        entry.available > (item.totalUnits ?? 0) ||
        (entry.status !== 'open' && entry.available !== 0)
      )
        errors.push({
          path: `${root}.calendar.${i}.available`,
          message:
            'Stock incohérent avec la quantité de chambres ou leur état.',
        });
      if (
        (entry.minStay !== undefined && entry.minStay < 1) ||
        (entry.maxStay !== undefined && entry.maxStay < 1) ||
        (entry.minStay && entry.maxStay && entry.minStay > entry.maxStay)
      )
        errors.push({
          path: `${root}.calendar.${i}.minStay`,
          message: 'Durées de séjour incohérentes.',
        });
    });
  });
  if (expandedDays > 5000)
    errors.push({
      path: 'rooms',
      message:
        'Limite de 5 000 journées de tarifs et disponibilités par enregistrement.',
    });
  const cp = data.metadata?.contactPreferences;
  const declaredRooms = data.metadata?.general?.totalRooms;
  const inventory =
    data.rooms
      ?.filter((item) => item.enabled && !item.remove)
      .reduce((total, item) => total + (item.totalUnits || 0), 0) || 0;
  if (declaredRooms !== undefined && inventory > declaredRooms)
    errors.push({
      path: 'metadata.general.totalRooms',
      message:
        'Le nombre déclaré doit couvrir les unités des catégories actives.',
    });
  for (const [enabled, field] of [
    ['whatsappEnabled', 'whatsappNumber'],
    ['phoneEnabled', 'phoneNumber'],
    ['emailEnabled', 'contactEmail'],
    ['emailNotificationsEnabled', 'notificationEmail'],
  ] as const) {
    const contact = cp?.[field];
    if (
      submitting &&
      contact &&
      (field.endsWith('Email')
        ? !z.string().email().safeParse(contact).success
        : !/^\+?[\d ()-]{7,30}$/.test(contact))
    )
      errors.push({
        path: `metadata.contactPreferences.${field}`,
        message: 'Coordonnée invalide.',
      });
    if (submitting && cp?.[enabled] && !contact)
      errors.push({
        path: `metadata.contactPreferences.${field}`,
        message: 'Renseignez cette coordonnée avant d’activer ce contact.',
      });
  }
  if (errors.length) hotelValidationError(errors);
  return data;
}

export function validateHotelSubmission(data: HotelPublication) {
  validateHotelPublication(data, true);
  const fields: { path: string; message: string }[] = [];
  for (const key of ['name', 'propertyType', 'city', 'description'] as const)
    if (!data[key])
      fields.push({ path: key, message: 'Ce champ est obligatoire.' });
  const rooms =
    data.rooms?.filter((item) => item.enabled && !item.remove) || [];
  if (!rooms.length)
    fields.push({
      path: 'rooms',
      message: 'Ajoutez au moins une catégorie de chambres.',
    });
  data.rooms?.forEach((item, i) => {
    if (!item.enabled || item.remove) return;
    for (const key of [
      'name',
      'capacity',
      'adults',
      'beds',
      'totalUnits',
    ] as const)
      if (!item[key])
        fields.push({
          path: `rooms.${i}.${key}`,
          message: 'Ce champ est obligatoire.',
        });
    if (item.basePrice === undefined)
      fields.push({
        path: `rooms.${i}.basePrice`,
        message: 'Renseignez un tarif de base par nuit.',
      });
    for (const key of ['rates', 'calendar'] as const)
      item[key]?.forEach((entry, j) => {
        if (
          !entry.start ||
          !entry.end ||
          (key === 'rates' && (entry as { price?: number }).price === undefined)
        )
          fields.push({
            path: `rooms.${i}.${key}.${j}.start`,
            message: 'Terminez cette période avant la soumission.',
          });
      });
  });
  const cp = data.metadata?.contactPreferences;
  if (
    !(
      [
        'whatsappEnabled',
        'phoneEnabled',
        'emailEnabled',
        'internalMessagingEnabled',
        'contactFormEnabled',
        'reservationRequestEnabled',
      ] as const
    ).some((key) => cp?.[key])
  )
    fields.push({
      path: 'metadata.contactPreferences',
      message: 'Activez au moins un moyen de contact.',
    });
  if (fields.length) hotelValidationError(fields);
}

export function hotelPeriodDays(start: string, end: string) {
  const result: string[] = [];
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to < from ||
    to - from > 365 * 86400000
  )
    return result;
  for (let day = from; day <= to; day += 86400000)
    result.push(new Date(day).toISOString().slice(0, 10));
  return result;
}
