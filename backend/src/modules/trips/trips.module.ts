import { Module } from "@nestjs/common";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripPublicationService } from "./trip-publication.service";

@Module({
  controllers: [TripsController],
  providers: [TripsService, TripPublicationService],
})
export class TripsModule {}
