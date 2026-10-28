ALTER TABLE "HotelRoom" ADD COLUMN "metadata" JSONB;
ALTER TABLE "HotelRoomAvailability" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "HotelRoomAvailability" ADD CONSTRAINT "HotelRoomAvailability_nonnegative" CHECK ("available" >= 0) NOT VALID;
