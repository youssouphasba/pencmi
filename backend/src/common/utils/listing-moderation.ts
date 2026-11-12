import { BadRequestException, ConflictException } from "@nestjs/common";
import { ListingStatus, Prisma } from "@prisma/client";
import { BUSINESS_EMAIL_FLAG, queueBusinessEmail } from '../../modules/emails/business-email';

export const MODERATION_MODULES = [
  "real_estate",
  "hotels",
  "vehicles",
  "trips",
] as const;
export type ModerationModule = (typeof MODERATION_MODULES)[number];
export const MODERATION_STATUSES = [
  "draft",
  "pending_review",
  "active",
  "refused",
  "suspended",
  "expired",
] as const;
export const MODERATION_DECISIONS = ["active", "refused", "suspended"] as const;

const transitions: Partial<Record<ListingStatus, readonly ListingStatus[]>> = {
  pending_review: ["active", "refused"],
  active: ["suspended"],
  suspended: ["active", "refused"],
};

export function assertModerationTransition(
  previous: ListingStatus,
  next: ListingStatus,
  reason?: string,
) {
  if (next !== "active" && !reason?.trim())
    throw new BadRequestException("Un motif est nécessaire.");
  if (!transitions[previous]?.includes(next))
    throw new ConflictException(
      "Transition de modération non autorisée. Actualisez la file.",
    );
}

export function assertModerationVersion(updatedAt: Date, expected?: string) {
  if (expected && updatedAt.valueOf() !== Date.parse(expected)) {
    throw new ConflictException(
      "L’annonce a changé depuis son ouverture. Actualisez la file.",
    );
  }
}

const ownerRoutes: Record<ModerationModule, string> = {
  real_estate: "/dashboard/immobilier/annonces/",
  hotels: "/dashboard/hotels/annonces/",
  vehicles: "/dashboard/voitures/annonces/",
  trips: "/dashboard/voyages/trajets/",
};

const decisionCopy = {
  active: {
    type: "listing_approved",
    title: "Annonce validée",
    message: "Votre annonce a été validée.",
  },
  refused: {
    type: "listing_refused",
    title: "Annonce refusée",
    message:
      "Votre annonce a été refusée. Vous pouvez la corriger avant une nouvelle soumission.",
  },
  suspended: {
    type: "listing_suspended",
    title: "Annonce suspendue",
    message:
      "Votre annonce a été suspendue et n’est plus visible publiquement.",
  },
};

export async function recordListingDecision(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  module: ModerationModule,
  row: { id: string; ownerUserId: string; status: ListingStatus },
  next: (typeof MODERATION_DECISIONS)[number],
  reason?: string,
) {
  const motif = reason?.trim() || null;
  const reactivated = row.status === "suspended" && next === "active";
  await tx.auditLog.create({
    data: {
      actorUserId,
      module,
      targetType: "listing",
      targetId: row.id,
      action: module === "trips" ? `trip.${next}` : `listing.${next}`,
      metadata: { previousStatus: row.status, newStatus: next, reason: motif },
    },
  });
  const copy = reactivated
    ? {
        type: "listing_reactivated",
        title: "Annonce réactivée",
        message: "Votre annonce a été réactivée.",
      }
    : decisionCopy[next];
  const notification = await tx.notification.create({
    data: {
      userId: row.ownerUserId,
      module,
      ...copy,
      message: motif ? `${copy.message} Motif : ${motif}` : copy.message,
      targetUrl: ownerRoutes[module],
      metadata: { listingId: row.id, status: next },
    },
  });
  if (process.env[BUSINESS_EMAIL_FLAG] === 'true')
    await queueBusinessEmail(tx, 'listing_decision', notification.id, row.ownerUserId, ownerRoutes[module]);
}
