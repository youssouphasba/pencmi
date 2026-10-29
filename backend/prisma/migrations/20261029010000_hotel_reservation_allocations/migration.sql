ALTER TABLE "HotelReservationRequest"
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "units" INTEGER,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestFingerprint" TEXT;

CREATE UNIQUE INDEX "HotelReservationRequest_idempotencyKey_key" ON "HotelReservationRequest"("idempotencyKey");
CREATE INDEX "HotelReservationRequest_roomId_checkIn_checkOut_idx" ON "HotelReservationRequest"("roomId", "checkIn", "checkOut");
CREATE INDEX "HotelReservationRequest_propertyId_fingerprint_createdAt_idx" ON "HotelReservationRequest"("propertyId", "requestFingerprint", "createdAt");
ALTER TABLE "HotelReservationRequest" ADD CONSTRAINT "HotelReservationRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HotelReservationRequest" ADD CONSTRAINT "HotelReservationRequest_stay_valid" CHECK ("roomId" IS NULL OR ("units" IS NOT NULL AND "units" > 0 AND "guests" IS NOT NULL AND "guests" > 0 AND "checkIn" IS NOT NULL AND "checkOut" IS NOT NULL AND "checkOut" > "checkIn")) NOT VALID;

CREATE TABLE "HotelStockAllocation" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "units" INTEGER NOT NULL CHECK ("units" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "HotelStockAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelStockAllocation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HotelReservationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HotelStockAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelStockAllocation_requestId_date_key" ON "HotelStockAllocation"("requestId", "date");
CREATE INDEX "HotelStockAllocation_roomId_date_releasedAt_idx" ON "HotelStockAllocation"("roomId", "date", "releasedAt");

CREATE TABLE "HotelReservationEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "fromStatus" "RequestStatus",
  "toStatus" "RequestStatus" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelReservationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelReservationEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HotelReservationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelReservationEvent_requestId_createdAt_idx" ON "HotelReservationEvent"("requestId", "createdAt");
