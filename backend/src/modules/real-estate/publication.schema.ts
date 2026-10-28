import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export {
  MAX_LISTING_PHOTOS,
  MAX_PHOTO_BYTES,
  OWNER_PHOTO_QUOTA,
} from '../../files/listing-photo.constants';
const text = (max = 200) => z.string().trim().max(max).optional();
const number = z.number().finite().min(0).max(2147483647).optional();
const count = z.number().int().min(0).max(10000).optional();
const flag = z.boolean().optional();
const phone = text(40);
const email = z.union([z.literal(''), z.string().email().max(254)]).optional();
export const publicationSchema = z
  .object({
    transaction: z.enum(['location', 'vente', 'achat']).optional(),
    propertyType: z
      .enum([
        'appartement',
        'maison',
        'villa',
        'terrain',
        'studio',
        'chambre',
        'bureau',
        'commerce',
      ])
      .optional(),
    title: text(200),
    description: text(1200),
    metadata: z
      .object({
        location: z
          .object({
            country: z.literal('SN').optional(),
            region: text(),
            department: text(),
            city: text(),
            district: text(),
            addressHint: text(500),
            latitude: z.number().min(-90).max(90).optional(),
            longitude: z.number().min(-180).max(180).optional(),
            isApproximateLocation: flag,
          })
          .strict()
          .optional(),
        pricing: z
          .object({
            price: number.refine(
              (v) => v === undefined || Number.isInteger(v),
              'Prix entier attendu.',
            ),
            currency: z.literal('FCFA').optional(),
            pricePeriod: z.enum(['month', 'day', 'total']).optional(),
            negotiable: flag,
          })
          .strict()
          .optional(),
        features: z
          .object({
            surface: number,
            rooms: count,
            bedrooms: count,
            bathrooms: count,
            floor: count,
            totalFloors: count,
            furnished: flag,
            parking: flag,
            balcony: flag,
            terrace: flag,
            pool: flag,
            airConditioning: flag,
            securityGuard: flag,
            generator: flag,
            individualElectricityMeter: flag,
            waterAvailable: flag,
          })
          .strict()
          .optional(),
        conditions: z
          .object({
            deposit: number,
            advancePayment: number,
            agencyFee: number,
            charges: number,
            extraFees: number,
            availableFrom: z
              .union([z.literal(''), z.string().date()])
              .optional(),
            noAgencyFee: flag,
            chargesIncluded: flag,
            availableImmediately: flag,
          })
          .strict()
          .optional(),
        documents: z
          .array(
            z
              .object({
                type: z.enum([
                  'titre_foncier',
                  'bail',
                  'deliberation',
                  'nicad',
                  'plan',
                  'building_permit',
                  'other',
                ]),
                available: z.boolean(),
              })
              .strict(),
          )
          .max(7)
          .refine(
            (items) =>
              new Set(items.map((item) => item.type)).size === items.length,
          )
          .optional(),
        contactPreferences: z
          .object({
            whatsappEnabled: flag,
            phoneEnabled: flag,
            emailEnabled: flag,
            internalMessagingEnabled: flag,
            contactFormEnabled: flag,
            visitRequestEnabled: flag,
            emailNotificationsEnabled: flag,
            whatsappNumber: phone,
            phoneNumber: phone,
            contactEmail: email,
            notificationEmail: email,
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function validatePublication(value: unknown) {
  const parsed = publicationSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Vérifiez les champs de votre annonce.',
      fields: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: 'Valeur invalide pour ce champ.',
      })),
    });
  }
  return parsed.data;
}

export function validateSubmission(value: z.infer<typeof publicationSchema>) {
  const fields: { path: string; message: string }[] = [];
  const required = (valid: unknown, path: string, message: string) => {
    if (!valid) fields.push({ path, message });
  };
  required(value.transaction, 'transaction', 'Sélectionnez le type d’annonce.');
  required(value.propertyType, 'propertyType', 'Sélectionnez le type de bien.');
  required(
    value.metadata?.location?.region,
    'metadata.location.region',
    'Renseignez la région.',
  );
  required(
    value.metadata?.location?.city,
    'metadata.location.city',
    'Renseignez la ville.',
  );
  required(
    (value.metadata?.pricing?.price ?? 0) > 0,
    'metadata.pricing.price',
    'Renseignez un prix supérieur à zéro.',
  );
  required(value.title, 'title', 'Renseignez le titre.');
  const p = value.metadata?.contactPreferences;
  required(
    p &&
      [
        'whatsappEnabled',
        'phoneEnabled',
        'emailEnabled',
        'internalMessagingEnabled',
        'contactFormEnabled',
        'visitRequestEnabled',
      ].some((key) => p[key as keyof typeof p] === true),
    'metadata.contactPreferences',
    'Activez un moyen de contact.',
  );
  const validPhone = (v?: string) => /^\+?[\d\s()-]{7,30}$/.test(v || '');
  if (p?.whatsappEnabled)
    required(
      validPhone(p.whatsappNumber),
      'metadata.contactPreferences.whatsappNumber',
      'Numéro WhatsApp invalide.',
    );
  if (p?.phoneEnabled)
    required(
      validPhone(p.phoneNumber),
      'metadata.contactPreferences.phoneNumber',
      'Numéro de téléphone invalide.',
    );
  if (p?.emailEnabled)
    required(
      p.contactEmail,
      'metadata.contactPreferences.contactEmail',
      'Renseignez l’email de contact.',
    );
  if (p?.emailNotificationsEnabled)
    required(
      p.notificationEmail,
      'metadata.contactPreferences.notificationEmail',
      'Renseignez l’email de notification.',
    );
  if (fields.length)
    throw new BadRequestException({
      message: 'Votre annonce est incomplète.',
      fields,
    });
}
