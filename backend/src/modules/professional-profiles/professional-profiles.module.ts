import { Module } from '@nestjs/common';
import { FilesModule } from '../../files/files.module';
import { ProfessionalProfilesController } from './professional-profiles.controller';
import { ProfessionalProfilesService } from './professional-profiles.service';

@Module({
  imports: [FilesModule],
  controllers: [ProfessionalProfilesController],
  providers: [ProfessionalProfilesService],
})
export class ProfessionalProfilesModule {}
