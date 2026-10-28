import { Module } from '@nestjs/common';
import { HotelIntegrationsController } from './hotel-integrations.controller';
import { HotelPartnerController } from './hotel-partner.controller';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { HotelPartnerGuard } from './hotel-partner.guard';

@Module({
  controllers: [HotelIntegrationsController, HotelPartnerController],
  providers: [HotelIntegrationsService, HotelPartnerGuard],
})
export class HotelIntegrationsModule {}
