-- Retired per-property partner API (/api/hotel-partner/v1). Its tables were never
-- written to; refuse to drop them if they somehow hold data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "HotelApiKey") OR EXISTS (SELECT 1 FROM "HotelWebhook")
     OR EXISTS (SELECT 1 FROM "HotelWebhookDelivery") OR EXISTS (SELECT 1 FROM "HotelSyncLog")
     OR EXISTS (SELECT 1 FROM "HotelSyncConflict") OR EXISTS (SELECT 1 FROM "HotelExternalMapping")
     OR EXISTS (SELECT 1 FROM "HotelFieldMapping")
     OR EXISTS (SELECT 1 FROM "HotelIntegration" WHERE "sourceOfTruth" <> 'pencmi') THEN
    RAISE EXCEPTION 'Retired hotel partner API tables hold data: back up and review before dropping.';
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "HotelApiKey" DROP CONSTRAINT "HotelApiKey_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "HotelWebhook" DROP CONSTRAINT "HotelWebhook_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "HotelWebhookDelivery" DROP CONSTRAINT "HotelWebhookDelivery_webhookId_fkey";

-- DropForeignKey
ALTER TABLE "HotelSyncLog" DROP CONSTRAINT "HotelSyncLog_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "HotelSyncConflict" DROP CONSTRAINT "HotelSyncConflict_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "HotelExternalMapping" DROP CONSTRAINT "HotelExternalMapping_integrationId_fkey";

-- DropForeignKey
ALTER TABLE "HotelFieldMapping" DROP CONSTRAINT "HotelFieldMapping_integrationId_fkey";

-- AlterTable
ALTER TABLE "HotelIntegration" DROP COLUMN "sourceOfTruth";

-- DropTable
DROP TABLE "HotelApiKey";

-- DropTable
DROP TABLE "HotelWebhook";

-- DropTable
DROP TABLE "HotelWebhookDelivery";

-- DropTable
DROP TABLE "HotelSyncLog";

-- DropTable
DROP TABLE "HotelSyncConflict";

-- DropTable
DROP TABLE "HotelExternalMapping";

-- DropTable
DROP TABLE "HotelFieldMapping";

