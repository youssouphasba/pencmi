import { Module } from '@nestjs/common';
import { HotelIntegrationsController } from './hotel-integrations.controller';
import { HotelPartnerController } from './hotel-partner.controller';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { HotelPartnerGuard } from './hotel-partner.guard';
import { HotelCalendarController, HotelChannelController, HotelSyncController } from './hotel-sync.controller';
import { HotelSyncService } from './hotel-sync.service';
import { HotelChannelGuard } from './hotel-channel.guard';
import { HotelChannelPartnersController, HotelChannelPartnersService } from './hotel-channel-partners';
import { HotelIcalProcessor } from './hotel-ical.processor';

@Module({
  controllers: [
    HotelSyncController,
    HotelIntegrationsController,
    HotelPartnerController,
    HotelCalendarController,
    HotelChannelController,
    HotelChannelPartnersController,
  ],
  providers: [
    HotelIntegrationsService,
    HotelPartnerGuard,
    HotelSyncService,
    HotelChannelGuard,
    HotelChannelPartnersService,
    HotelIcalProcessor,
  ],
})
export class HotelIntegrationsModule {}
