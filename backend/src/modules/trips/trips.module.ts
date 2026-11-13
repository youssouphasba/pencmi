import { Module } from "@nestjs/common";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripPublicationService } from "./trip-publication.service";
import { TripOccurrencesService } from "./trip-occurrences.service";
import { TripBoardingController, TripBoardingService } from "./trip-boarding";

@Module({
  controllers: [TripsController, TripBoardingController],
  providers: [TripsService, TripPublicationService, TripOccurrencesService, TripBoardingService],
})
export class TripsModule {}
