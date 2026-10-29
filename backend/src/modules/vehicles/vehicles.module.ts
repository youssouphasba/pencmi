import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { FilesModule } from '../../files/files.module';
import { VehiclePublicationService } from './vehicle-publication.service';

@Module({
  imports: [FilesModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclePublicationService],
})
export class VehiclesModule {}
