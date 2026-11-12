-- Hotel calendar (iCal) and channel manager synchronisation.

-- Opening the integration page used to create an integration that already claimed the
-- external software as source of truth, which blocked confirmations on Pencmi. That only
-- applies to active integrations now; inactive ones fall back to Pencmi.
ALTER TABLE "HotelIntegration" ALTER COLUMN "sourceOfTruth" SET DEFAULT 'pencmi';
UPDATE "HotelIntegration" SET "sourceOfTruth" = 'pencmi' WHERE "status" <> 'active';
ALTER TABLE "HotelIntegration" ADD COLUMN "syncMode" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "HotelIntegration" ADD COLUMN "autoConfirm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HotelIntegration" ADD COLUMN "hotelCode" TEXT;
ALTER TABLE "HotelIntegration" ADD COLUMN "channelPartnerId" TEXT;
CREATE UNIQUE INDEX "HotelIntegration_hotelCode_key" ON "HotelIntegration"("hotelCode");
CREATE INDEX "HotelIntegration_channelPartnerId_idx" ON "HotelIntegration"("channelPartnerId");

ALTER TABLE "HotelRoom" ADD COLUMN "icalExportToken" TEXT;
CREATE UNIQUE INDEX "HotelRoom_icalExportToken_key" ON "HotelRoom"("icalExportToken");

ALTER TABLE "HotelStockAllocation" ADD COLUMN "channelAckedAt" TIMESTAMP(3);

CREATE TABLE "HotelIcalImport" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "unitsPerEvent" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelIcalImport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HotelIcalImport_roomId_idx" ON "HotelIcalImport"("roomId");
CREATE INDEX "HotelIcalImport_active_lastAttemptAt_idx" ON "HotelIcalImport"("active", "lastAttemptAt");

CREATE TABLE "HotelExternalBlock" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "units" INTEGER NOT NULL,
    CONSTRAINT "HotelExternalBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelExternalBlock_importId_date_key" ON "HotelExternalBlock"("importId", "date");
CREATE INDEX "HotelExternalBlock_roomId_date_idx" ON "HotelExternalBlock"("roomId", "date");

CREATE TABLE "HotelChannelPartner" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelChannelPartner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelChannelPartner_code_key" ON "HotelChannelPartner"("code");

CREATE TABLE "HotelChannelEvent" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),
    CONSTRAINT "HotelChannelEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelChannelEvent_requestId_kind_key" ON "HotelChannelEvent"("requestId", "kind");
CREATE INDEX "HotelChannelEvent_integrationId_ackedAt_createdAt_idx" ON "HotelChannelEvent"("integrationId", "ackedAt", "createdAt");

ALTER TABLE "HotelIntegration" ADD CONSTRAINT "HotelIntegration_channelPartnerId_fkey" FOREIGN KEY ("channelPartnerId") REFERENCES "HotelChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelIcalImport" ADD CONSTRAINT "HotelIcalImport_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelExternalBlock" ADD CONSTRAINT "HotelExternalBlock_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HotelIcalImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelExternalBlock" ADD CONSTRAINT "HotelExternalBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelChannelEvent" ADD CONSTRAINT "HotelChannelEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelChannelEvent" ADD CONSTRAINT "HotelChannelEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HotelReservationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
