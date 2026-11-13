import { Module } from '@nestjs/common';
import { HotelCalendarController, HotelChannelController, HotelSyncController } from './hotel-sync.controller';
import { HotelSyncService } from './hotel-sync.service';
import { HotelChannelGuard } from './hotel-channel.guard';
import { HotelChannelPartnersController, HotelChannelPartnersService } from './hotel-channel-partners';
import { HotelIcalProcessor } from './hotel-ical.processor';
import { HotelWebhookProcessor } from './hotel-webhook.processor';
import { HotelWebhookService } from './hotel-webhooks';

@Module({
  controllers: [
    HotelSyncController,
    HotelCalendarController,
    HotelChannelController,
    HotelChannelPartnersController,
  ],
  providers: [
    HotelSyncService,
    HotelChannelGuard,
    HotelChannelPartnersService,
    HotelIcalProcessor,
    HotelWebhookService,
    HotelWebhookProcessor,
  ],
})
export class HotelIntegrationsModule {}
