import { Module } from "@nestjs/common";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripPublicationService } from "./trip-publication.service";
import { TripOccurrencesService } from "./trip-occurrences.service";

@Module({
  controllers: [TripsController],
  providers: [TripsService, TripPublicationService, TripOccurrencesService],
})
export class TripsModule {}
