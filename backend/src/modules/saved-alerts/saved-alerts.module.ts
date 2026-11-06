import { Module } from '@nestjs/common';
import { SavedAlertsController } from './saved-alerts.controller';
import { SavedAlertsProcessor } from './saved-alerts.processor';
import { SavedAlertsService } from './saved-alerts.service';

@Module({ controllers: [SavedAlertsController], providers: [SavedAlertsService, SavedAlertsProcessor] })
export class SavedAlertsModule {}
