-- AlterTable
ALTER TABLE "TripSeatRequest" ADD COLUMN     "boardedAt" TIMESTAMP(3),
ADD COLUMN     "boardingStatus" TEXT,
ADD COLUMN     "ticketCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TripSeatRequest_ticketCode_key" ON "TripSeatRequest"("ticketCode");


-- Tickets for seats confirmed before this migration (10 characters, no 0/O/1/I).
UPDATE "TripSeatRequest"
SET "ticketCode" = translate(upper(substr(md5(random()::text || "id" || clock_timestamp()::text), 1, 10)), '01', '89')
WHERE "status" IN ('accepted', 'completed') AND "ticketCode" IS NULL;
