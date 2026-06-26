CREATE TYPE "AdvertiserReviewStatus" AS ENUM ('pending_review', 'published', 'rejected', 'archived');

CREATE TABLE "AdvertiserReview" (
    "id" TEXT NOT NULL,
    "advertiserUserId" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "module" "PencmiModule",
    "targetType" "TargetType",
    "targetId" TEXT,
    "status" "AdvertiserReviewStatus" NOT NULL DEFAULT 'pending_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "moderatedAt" TIMESTAMP(3),

    CONSTRAINT "AdvertiserReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvertiserReview_advertiserUserId_status_createdAt_idx" ON "AdvertiserReview"("advertiserUserId", "status", "createdAt");
CREATE INDEX "AdvertiserReview_reviewerUserId_createdAt_idx" ON "AdvertiserReview"("reviewerUserId", "createdAt");
CREATE INDEX "AdvertiserReview_module_targetType_targetId_idx" ON "AdvertiserReview"("module", "targetType", "targetId");

ALTER TABLE "AdvertiserReview" ADD CONSTRAINT "AdvertiserReview_advertiserUserId_fkey" FOREIGN KEY ("advertiserUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvertiserReview" ADD CONSTRAINT "AdvertiserReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
