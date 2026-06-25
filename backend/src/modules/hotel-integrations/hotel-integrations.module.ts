import { Module } from '@nestjs/common';
import { HotelIntegrationsController } from './hotel-integrations.controller';
import { HotelPartnerController } from './hotel-partner.controller';
import { HotelIntegrationsService } from './hotel-integrations.service';

@Module({
  controllers: [HotelIntegrationsController, HotelPartnerController],
  providers: [HotelIntegrationsService],
})
export class HotelIntegrationsModule {}
