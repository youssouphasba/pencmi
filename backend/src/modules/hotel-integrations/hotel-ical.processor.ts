import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HotelSyncService } from './hotel-sync.service';

const INTERVAL_MS = 60_000;
export const hotelSyncProcessorEnabled = () => process.env.HOTEL_SYNC_PROCESSOR_ENABLED === 'true';

/** Reads the hotel calendars again every few minutes. State lives in PostgreSQL. */
@Injectable()
export class HotelIcalProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotelIcalProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly service: HotelSyncService) {}

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
      await this.service.refreshDue();
    } catch {
      this.logger.error('Lecture des calendriers interrompue. Nouvelle tentative au prochain passage.');
    } finally {
      this.running = false;
    }
  }
}
