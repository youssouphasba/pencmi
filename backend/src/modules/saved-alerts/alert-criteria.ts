import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ListingModule } from '../conversations/conversation-listings';
import { TRIP_TYPES, TRIP_TYPE_ALIASES } from '../trips/trip-publication.schema';
import { VEHICLE_MODES } from '../vehicles/vehicle-publication.schema';

export const CRITERIA_VERSION = 1;
const text = (max: number) => z.string().trim().min(1).max(max).optional();
const amount = z.number().int().min(0).max(2147483647).optional();

const SCHEMAS = {
  real_estate: z.strictObject({ transaction: text(40), propertyType: text(60), city: text(150), minPrice: amount, maxPrice: amount, minSurface: amount }),
  // No price and no dates: a property's stock and rates give no reliable comparison across rooms.
  hotels: z.strictObject({ city: text(150), propertyType: text(60) }),
  vehicles: z.strictObject({
    vehicleMode: z.enum(VEHICLE_MODES).optional(), brand: text(100), model: text(100), city: text(150), minPrice: amount, maxPrice: amount,
    minYear: z.number().int().min(1900).max(2100).optional(), fuel: text(60), gearbox: text(60),
  }),
  trips: z.strictObject({
    departureCity: text(150), arrivalCity: text(150), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), passengers: z.number().int().min(1).max(200).optional(),
    minPrice: amount, maxPrice: amount, vehicleType: z.enum(TRIP_TYPES).optional(), timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  }),
} as const;

// Validated per universe by the schemas above.
export type Filters = Record<string, any>;

/** Today in Africa/Dakar, which stays at UTC+0 all year round. */
const today = (now: Date) => now.toISOString().slice(0, 10);

export function validateFilters(module: ListingModule, raw: unknown, now = new Date()): Filters {
  const result = SCHEMAS[module].safeParse(raw);
  if (!result.success)
    throw new BadRequestException({
      message: 'Vérifiez les critères de l’alerte.',
      fields: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  const filters = Object.fromEntries(Object.entries(result.data).filter(([, value]) => value !== undefined)) as Filters;
  if (!Object.keys(filters).length) throw new BadRequestException('Indiquez au moins un critère.');
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice)
    throw new BadRequestException('Fourchette de prix invalide.');
  if (typeof filters.date === 'string') {
    const day = new Date(`${filters.date}T00:00:00Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== filters.date) throw new BadRequestException('Date invalide.');
    if (filters.date < today(now)) throw new BadRequestException('Cette date est déjà passée.');
  }
  return filters;
}

const contains = (value: unknown) => ({ contains: value as string, mode: 'insensitive' as const });
const jsonText = (paths: string[][], value: unknown) => ({
  OR: paths.map((path) => ({ metadata: { path, string_contains: value as string, mode: 'insensitive' as const } })),
});
const jsonAtLeast = (paths: string[][], value: unknown) => ({ OR: paths.map((path) => ({ metadata: { path, gte: value as number } })) });
const priceRange = (filters: Filters, field = 'price') =>
  filters.minPrice !== undefined || filters.maxPrice !== undefined ? [{ [field]: { gte: filters.minPrice, lte: filters.maxPrice } }] : [];
const PUBLIC = { status: 'active' as const, deletedAt: null };
const HOURS: Record<string, { gte: string; lt: string }> = {
  morning: { gte: '06:00', lt: '12:00' }, afternoon: { gte: '12:00', lt: '17:00' }, evening: { gte: '17:00', lt: '21:00' },
};

export function tripOccurrenceWhere(filters: Filters, now = new Date()): Prisma.TripOccurrenceWhereInput {
  return {
    cancelledAt: null,
    departureAt: { gt: now },
    remainingSeats: { gte: filters.passengers || 1 },
    ...(filters.date ? { serviceDate: new Date(`${filters.date}T00:00:00Z`) } : {}),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined ? { pricePerSeat: { gte: filters.minPrice, lte: filters.maxPrice } } : {}),
  };
}

/**
 * One definition of "matches", in PostgreSQL, for both the preview and the notifications.
 * Same meaning as the public searches; only public listings can ever satisfy it.
 */
export function matchWhere(module: ListingModule, filters: Filters, now = new Date()): any {
  if (module === 'real_estate')
    return { ...PUBLIC, AND: [
      ...(filters.transaction ? [{ transaction: filters.transaction }] : []),
      ...(filters.propertyType ? [{ propertyType: { equals: filters.propertyType, mode: 'insensitive' as const } }] : []),
      ...(filters.city ? [{ OR: [{ city: contains(filters.city) }, { neighborhood: contains(filters.city) }] }] : []),
      ...priceRange(filters),
      ...(filters.minSurface !== undefined ? [jsonAtLeast([['publication', 'features', 'surface'], ['surface']], filters.minSurface)] : []),
    ] } satisfies Prisma.RealEstateListingWhereInput;
  if (module === 'hotels')
    return { ...PUBLIC, AND: [
      ...(filters.propertyType ? [{ propertyType: { equals: filters.propertyType, mode: 'insensitive' as const } }] : []),
      ...(filters.city ? [{ OR: [{ city: contains(filters.city) }, { region: contains(filters.city) }, { name: contains(filters.city) }] }] : []),
    ] } satisfies Prisma.HotelPropertyWhereInput;
  if (module === 'vehicles')
    return { ...PUBLIC, AND: [
      ...(filters.vehicleMode ? [{ vehicleMode: filters.vehicleMode }] : []),
      ...(filters.city ? [{ OR: [{ city: contains(filters.city) }, { title: contains(filters.city) }, { description: contains(filters.city) }] }] : []),
      ...priceRange(filters),
      ...(filters.brand ? [jsonText([['publication', 'identity', 'brand'], ['brand']], filters.brand)] : []),
      ...(filters.model ? [jsonText([['publication', 'identity', 'model'], ['model']], filters.model)] : []),
      ...(filters.fuel ? [jsonText([['publication', 'info', 'fuel'], ['fuel']], filters.fuel)] : []),
      ...(filters.gearbox ? [jsonText([['publication', 'info', 'gearbox'], ['gearbox']], filters.gearbox)] : []),
      ...(filters.minYear !== undefined ? [jsonAtLeast([['publication', 'identity', 'year'], ['year']], filters.minYear)] : []),
    ] } satisfies Prisma.VehicleListingWhereInput;
  const type = filters.vehicleType as string | undefined;
  return { ...PUBLIC, AND: [
    ...(filters.departureCity ? [{ departureCity: contains(filters.departureCity) }] : []),
    ...(filters.arrivalCity ? [{ arrivalCity: contains(filters.arrivalCity) }] : []),
    ...(type ? [{ vehicleType: { in: [type, ...Object.keys(TRIP_TYPE_ALIASES).filter((key) => TRIP_TYPE_ALIASES[key] === type)] } }] : []),
    ...(filters.timeOfDay === 'night' ? [{ OR: [{ departureTime: { lt: '06:00' } }, { departureTime: { gte: '21:00' } }] }] : []),
    ...(filters.timeOfDay && HOURS[filters.timeOfDay] ? [{ departureTime: HOURS[filters.timeOfDay] }] : []),
    // A real future departure with enough seats, as in the public search.
    { occurrences: { some: tripOccurrenceWhere(filters, now) } },
  ] } satisfies Prisma.TripListingWhereInput;
}

export function canonical(filters: Filters) {
  return JSON.stringify(Object.keys(filters).sort().map((key) => [key, filters[key]]));
}

/** The public search page with the same filters, using the parameters each page really reads. */
export function searchUrl(module: ListingModule, filters: Filters) {
  const names: Record<ListingModule, [string, Record<string, string>]> = {
    real_estate: ['/immobilier', { transaction: 'transaction', propertyType: 'type', city: 'city', maxPrice: 'maxPrice' }],
    hotels: ['/hotels', { city: 'city', propertyType: 'type' }],
    vehicles: ['/voitures', { vehicleMode: 'type', brand: 'brand', model: 'model', city: 'city', minPrice: 'minPrice', maxPrice: 'maxPrice', fuel: 'fuel', gearbox: 'gearbox' }],
    trips: ['/voyages', { departureCity: 'depart', arrivalCity: 'arrivee', date: 'date', passengers: 'passengers', vehicleType: 'vehicleType', minPrice: 'minPrice', maxPrice: 'maxPrice', timeOfDay: 'timeOfDay' }],
  };
  const [path, map] = names[module];
  if (Object.keys(filters).some((key) => !map[key])) return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (map[key]) query.set(map[key], String(value));
  return query.size ? `${path}?${query}` : path;
}
