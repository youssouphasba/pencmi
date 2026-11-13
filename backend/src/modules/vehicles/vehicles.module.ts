import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { FilesModule } from '../../files/files.module';
import { VehiclePublicationService } from './vehicle-publication.service';
import { VehicleCalendarController, VehicleCalendarService } from './vehicle-calendar';

@Module({
  imports: [FilesModule],
  controllers: [VehiclesController, VehicleCalendarController],
  providers: [VehiclesService, VehiclePublicationService, VehicleCalendarService],
})
export class VehiclesModule {}
