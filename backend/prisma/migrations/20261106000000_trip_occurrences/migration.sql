CREATE TABLE "TripOccurrence" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "serviceDate" DATE NOT NULL,
  "departureAt" TIMESTAMP(3) NOT NULL,
  "estimatedArrivalAt" TIMESTAMP(3),
  "totalCapacity" INTEGER NOT NULL,
  "offeredSeats" INTEGER NOT NULL,
  "confirmedSeats" INTEGER NOT NULL DEFAULT 0,
  "remainingSeats" INTEGER NOT NULL,
  "pricePerSeat" INTEGER NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripOccurrence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripOccurrence_capacity_check" CHECK ("totalCapacity" > 0 AND "offeredSeats" > 0 AND "offeredSeats" <= "totalCapacity" AND "confirmedSeats" >= 0 AND "remainingSeats" >= 0 AND "confirmedSeats" + "remainingSeats" = "offeredSeats"),
  CONSTRAINT "TripOccurrence_price_check" CHECK ("pricePerSeat" > 0),
  CONSTRAINT "TripOccurrence_arrival_check" CHECK ("estimatedArrivalAt" IS NULL OR "estimatedArrivalAt" > "departureAt"),
  CONSTRAINT "TripOccurrence_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TripOccurrence_tripId_departureAt_key" ON "TripOccurrence"("tripId", "departureAt");
CREATE INDEX "TripOccurrence_departureAt_cancelledAt_idx" ON "TripOccurrence"("departureAt", "cancelledAt");
ALTER TABLE "TripSeatRequest" ADD COLUMN "occurrenceId" TEXT, ADD COLUMN "allocatedSeats" INTEGER, ADD COLUMN "quotedPricePerSeat" INTEGER;
ALTER TABLE "TripSeatRequest" ADD CONSTRAINT "TripSeatRequest_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "TripOccurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripSeatRequest" ADD CONSTRAINT "TripSeatRequest_allocation_check" CHECK ("allocatedSeats" IS NULL OR ("allocatedSeats" >= 0 AND "allocatedSeats" <= "requestedSeats"));
ALTER TABLE "TripSeatRequest" ADD CONSTRAINT "TripSeatRequest_quote_check" CHECK ("quotedPricePerSeat" IS NULL OR "quotedPricePerSeat" > 0);
CREATE INDEX "TripSeatRequest_occurrenceId_status_idx" ON "TripSeatRequest"("occurrenceId", "status");
