import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { hotelSyncProcessorEnabled } from './hotel-ical.processor';
import { HotelWebhookService } from './hotel-webhooks';

const INTERVAL_MS = 10_000;

/** Sends the channel manager webhooks that are due. State lives in PostgreSQL. */
@Injectable()
export class HotelWebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotelWebhookProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly service: HotelWebhookService) {}

  onModuleInit() {
    if (!hotelSyncProcessorEnabled()) return;
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.service.deliverDue();
    } catch {
      this.logger.error('Envoi des webhooks interrompu. Nouvelle tentative au prochain passage.');
    } finally {
      this.running = false;
    }
  }
}
