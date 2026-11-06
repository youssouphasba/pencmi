import { PrismaService } from '../../database/prisma/prisma.service';
import { ListingModule } from '../conversations/conversation-listings';

export type ListingCard = {
  listingId: string;
  available: boolean;
  title: string | null;
  city: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  url: string | null;
  photo: string | null;
  nextDeparture?: string | null;
};

const PUBLIC_PHOTO = /^(https?:\/\/|\/(?!\/)[A-Za-z0-9/_-]*files\/public\/[A-Za-z0-9_-]+$)/;

function publicPhoto(settings: unknown): string | null {
  const data = (settings || {}) as Record<string, any>;
  const photos = [data.coverPhoto, ...(Array.isArray(data.photos) ? data.photos : [])];
  return photos.find((value) => typeof value === 'string' && PUBLIC_PHOTO.test(value)) ?? null;
}

export function listingUrl(module: ListingModule, id: string, occurrenceId?: string | null) {
  const safe = encodeURIComponent(id);
  if (module === 'real_estate') return `/immobilier/annonce/?id=${safe}`;
  if (module === 'hotels') return `/hotels/detail/?id=${safe}`;
  if (module === 'vehicles') return `/voitures/detail/?id=${safe}`;
  return `/voyages/detail/?id=${safe}${occurrenceId ? `&occurrenceId=${encodeURIComponent(occurrenceId)}` : ''}`;
}

/** No private detail can come out of this: an unavailable listing gives its id and nothing else. */
function hidden(id: string): ListingCard {
  return { listingId: id, available: false, title: null, city: null, price: null, currency: null, category: null, url: null, photo: null };
}

const isPublic = (row: { status: string; deletedAt: Date | null }) => row.status === 'active' && !row.deletedAt;

/** The public view of a page of listings, read in one query per universe. */
export async function loadCards(prisma: PrismaService, module: ListingModule, ids: string[], now = new Date()): Promise<Map<string, ListingCard>> {
  const cards = new Map<string, ListingCard>(ids.map((id) => [id, hidden(id)]));
  if (!ids.length) return cards;
  const where = { id: { in: ids } };
  if (module === 'real_estate') {
    const rows = await prisma.realEstateListing.findMany({ where });
    for (const row of rows.filter(isPublic))
      cards.set(row.id, { listingId: row.id, available: true, title: row.title, city: row.city, price: row.price, currency: row.currency, category: row.propertyType, url: listingUrl(module, row.id), photo: publicPhoto(row.metadata) });
  } else if (module === 'vehicles') {
    const rows = await prisma.vehicleListing.findMany({ where });
    for (const row of rows.filter(isPublic))
      cards.set(row.id, { listingId: row.id, available: true, title: row.title, city: row.city, price: row.price, currency: row.currency, category: row.vehicleMode, url: listingUrl(module, row.id), photo: publicPhoto(row.metadata) });
  } else if (module === 'hotels') {
    const rows = await prisma.hotelProperty.findMany({ where, include: { rooms: { select: { status: true, metadata: true } } } });
    for (const row of rows.filter(isPublic)) {
      const prices = row.rooms
        .filter((room) => room.status === 'active')
        .map((room) => (room.metadata as any)?.basePrice)
        .filter((value) => Number.isFinite(value));
      cards.set(row.id, { listingId: row.id, available: true, title: row.name, city: row.city, price: prices.length ? Math.min(...prices) : null, currency: prices.length ? 'FCFA' : null, category: row.propertyType, url: listingUrl(module, row.id), photo: publicPhoto(row.contactSettings) });
    }
  } else {
    // The favorite stays on the stable trip; the link goes to a departure that really exists.
    const rows = await prisma.tripListing.findMany({
      where,
      include: { occurrences: { where: { cancelledAt: null, departureAt: { gt: now } }, orderBy: [{ departureAt: 'asc' }, { id: 'asc' }], take: 1 } },
    });
    for (const row of rows.filter(isPublic)) {
      const next = row.occurrences[0];
      cards.set(row.id, { listingId: row.id, available: true, title: row.title, city: `${row.departureCity} → ${row.arrivalCity}`, price: next?.pricePerSeat ?? row.pricePerSeat, currency: row.currency, category: row.vehicleType, url: listingUrl(module, row.id, next?.id), photo: null, nextDeparture: next ? next.departureAt.toISOString() : null });
    }
  }
  return cards;
}
