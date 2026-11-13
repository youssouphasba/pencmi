-- CreateTable
CREATE TABLE "VehicleAvailabilityBlock" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleAvailabilityBlock_listingId_startDate_idx" ON "VehicleAvailabilityBlock"("listingId", "startDate");

-- AddForeignKey
ALTER TABLE "VehicleAvailabilityBlock" ADD CONSTRAINT "VehicleAvailabilityBlock_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "VehicleAvailabilityBlock" ADD CONSTRAINT "VehicleAvailabilityBlock_dates_check" CHECK ("endDate" > "startDate");
