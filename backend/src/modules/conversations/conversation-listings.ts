import { PrismaService } from "../../database/prisma/prisma.service";

export const LISTING_MODULES = [
  "real_estate",
  "hotels",
  "vehicles",
  "trips",
] as const;
export type ListingModule = (typeof LISTING_MODULES)[number];

export function isListingModule(value: unknown): value is ListingModule {
  return LISTING_MODULES.includes(value as ListingModule);
}

export type MessagingListing = {
  id: string;
  ownerUserId: string;
  title: string;
  visible: boolean;
  messagingEnabled: boolean;
};

const ownerStatus = { owner: { select: { status: true, deletedAt: true } } };

function normalize(row: any, title: string, settings: unknown): MessagingListing {
  const preferences = (settings as any)?.publication?.contactPreferences;
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title,
    visible:
      row.status === "active" &&
      !row.deletedAt &&
      row.owner?.status === "active" &&
      !row.owner?.deletedAt,
    // Strict: a listing without an explicit choice has no messaging channel.
    messagingEnabled: preferences?.internalMessagingEnabled === true,
  };
}

/** The real listing behind a conversation, whatever the universe. */
export async function findMessagingListing(
  prisma: PrismaService,
  module: ListingModule,
  id: string,
): Promise<MessagingListing | null> {
  if (module === "hotels") {
    const row = await prisma.hotelProperty.findUnique({
      where: { id },
      include: ownerStatus,
    });
    return row && normalize(row, row.name, row.contactSettings);
  }
  const delegate: any = {
    real_estate: prisma.realEstateListing,
    vehicles: prisma.vehicleListing,
    trips: prisma.tripListing,
  }[module];
  const row = await delegate.findUnique({ where: { id }, include: ownerStatus });
  return row && normalize(row, row.title, row.metadata);
}

/** Listings really owned by this user, including deleted ones so that history stays readable. */
export async function ownedListings(
  prisma: PrismaService,
  module: ListingModule,
  ownerUserId: string,
  search?: string,
): Promise<{ id: string; title: string }[]> {
  const contains = search ? { contains: search, mode: "insensitive" as const } : undefined;
  if (module === "hotels") {
    const rows = await prisma.hotelProperty.findMany({
      where: { ownerUserId, ...(contains ? { name: contains } : {}) },
      select: { id: true, name: true },
    });
    return rows.map((row) => ({ id: row.id, title: row.name }));
  }
  const delegate: any = {
    real_estate: prisma.realEstateListing,
    vehicles: prisma.vehicleListing,
    trips: prisma.tripListing,
  }[module];
  return delegate.findMany({
    where: { ownerUserId, ...(contains ? { title: contains } : {}) },
    select: { id: true, title: true },
  });
}

/** Titles of a page of targets, read per universe. */
export async function listingTitles(
  prisma: PrismaService,
  rows: { module: string; targetId?: string | null }[],
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  for (const module of LISTING_MODULES) {
    const ids = [
      ...new Set(
        rows
          .filter((row) => row.module === module && row.targetId)
          .map((row) => row.targetId as string),
      ),
    ];
    if (!ids.length) continue;
    if (module === "hotels") {
      const found = await prisma.hotelProperty.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      found.forEach((row) => titles.set(`${module}:${row.id}`, row.name));
      continue;
    }
    const delegate: any = {
      real_estate: prisma.realEstateListing,
      vehicles: prisma.vehicleListing,
      trips: prisma.tripListing,
    }[module];
    const found = await delegate.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });
    found.forEach((row: { id: string; title: string }) =>
      titles.set(`${module}:${row.id}`, row.title),
    );
  }
  return titles;
}

export function displayName(user?: {
  firstName?: string | null;
  lastName?: string | null;
  professionalProfile?: { businessName?: string | null } | null;
} | null): string | null {
  if (!user) return null;
  return (
    user.professionalProfile?.businessName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    null
  );
}
