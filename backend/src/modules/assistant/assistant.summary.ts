import type { ToolContext } from './assistant.catalog';

// Builds the compact text the model sees for a read result. Whitelist only: anything not listed
// (owner identity, phone numbers, emails, photos, message bodies, internal fields) never reaches the model.
const PUBLIC_KEYS = new Set([
  'id', 'occurrenceId', 'title', 'name', 'description', 'question', 'answer', 'category',
  'transaction', 'propertyType', 'city', 'neighborhood', 'region', 'district',
  'price', 'currency', 'priceFrom', 'nightlyPrice', 'basePrice', 'stars', 'amenities', 'checkInTime', 'checkOutTime',
  'rooms', 'roomType', 'capacity', 'vehicleMode', 'brand', 'model', 'year', 'mileage', 'fuel', 'gearbox', 'seats',
  'pricePerDay', 'pricePerWeek', 'pricePerMonth', 'deposit', 'pricePerTrip', 'negotiable',
  'vehicleType', 'departureCity', 'arrivalCity', 'departurePoint', 'arrivalPoint', 'departureDate', 'departureTime',
  'availableSeats', 'pricePerSeat', 'occurrences', 'serviceDate', 'departureAt', 'remainingSeats', 'durationMinutes',
  'vehicleLabel', 'conditions', 'metadata', 'total', 'page', 'totalPages',
]);
// 'name' is excluded on purpose: on private records it is often a person (client, contact).
const REF_KEYS = new Set([
  'id', 'type', 'module', 'status', 'active', 'title', 'city', 'createdAt', 'updatedAt',
  'checkIn', 'checkOut', 'startDate', 'endDate', 'preferredDate', 'guests', 'units', 'requestedSeats',
  'departureAt', 'serviceDate', 'occurrenceId', 'roomId', 'listingId', 'targetId',
  'listing', 'target', 'property', 'trip', 'vehicle', 'room', 'occurrence', 'filters',
  'data', 'items', 'requests', 'total', 'page', 'totalPages',
]);
const MAX_TEXT = 240;
const MAX_ITEMS = 8;
const MAX_CHARS = 6000;

function clean(value: unknown, keys: Set<string>, depth: number): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth > 4) return undefined;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map(item => clean(item, keys, depth + 1)).filter(item => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!keys.has(key)) continue;
      const cleaned = clean(item, keys, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

export function countItems(result: any) {
  const body = result?.data ?? result;
  if (Array.isArray(body)) return body.length;
  for (const key of ['data', 'items', 'conversations', 'messages', 'requests']) if (Array.isArray(body?.[key])) return body[key].length;
  return body ? 1 : 0;
}

/** Text given to the model for a read result, according to the tool's context level. */
export function modelView(result: any, context: ToolContext | undefined, module?: string) {
  const count = countItems(result);
  if (!context) return JSON.stringify({ shownToUser: true, items: count, note: 'Contenu privé affiché à l’utilisateur, non transmis à l’assistant.' });
  const keys = context === 'public' ? PUBLIC_KEYS : REF_KEYS;
  const body = result?.data ?? result;
  const list = Array.isArray(body);
  const cleaned = clean(body, keys, 0);
  const meta = clean(result?.meta, keys, 0);
  const text = JSON.stringify({ module, shownToUser: true, ...(list ? { items: cleaned ?? [], meta } : { item: cleaned }) });
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '…' : text;
}
