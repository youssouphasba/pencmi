import { Module } from '@nestjs/common';
import { AdminSeoController, SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  controllers: [SeoController, AdminSeoController],
  providers: [SeoService],
})
export class SeoModule {}
