import { Module } from '@nestjs/common';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { FilesModule } from '../../files/files.module';
import { HotelPublicationService } from './hotel-publication.service';

@Module({
  imports: [FilesModule],
  controllers: [HotelsController],
  providers: [HotelsService, HotelPublicationService],
})
export class HotelsModule {}
