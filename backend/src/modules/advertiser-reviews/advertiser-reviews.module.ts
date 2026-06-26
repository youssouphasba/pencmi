import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { AdvertiserReviewsController } from './advertiser-reviews.controller';
import { AdvertiserReviewsService } from './advertiser-reviews.service';

@Module({
  imports: [AuditModule],
  controllers: [AdvertiserReviewsController],
  providers: [AdvertiserReviewsService],
  exports: [AdvertiserReviewsService],
})
export class AdvertiserReviewsModule {}
