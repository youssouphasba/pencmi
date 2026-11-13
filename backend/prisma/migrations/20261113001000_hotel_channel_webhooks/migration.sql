-- AlterTable
ALTER TABLE "HotelChannelPartner" ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "HotelChannelWebhookDelivery" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "channelEventId" TEXT,
    "type" TEXT NOT NULL,
    "hotelCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "HotelChannelWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelChannelWebhookDelivery_channelEventId_key" ON "HotelChannelWebhookDelivery"("channelEventId");

-- CreateIndex
CREATE INDEX "HotelChannelWebhookDelivery_status_nextAttemptAt_idx" ON "HotelChannelWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "HotelChannelWebhookDelivery_partnerId_createdAt_idx" ON "HotelChannelWebhookDelivery"("partnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "HotelChannelWebhookDelivery" ADD CONSTRAINT "HotelChannelWebhookDelivery_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "HotelChannelPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelChannelWebhookDelivery" ADD CONSTRAINT "HotelChannelWebhookDelivery_channelEventId_fkey" FOREIGN KEY ("channelEventId") REFERENCES "HotelChannelEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

