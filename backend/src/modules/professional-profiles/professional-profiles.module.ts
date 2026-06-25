import { Module } from '@nestjs/common';
import { ProfessionalProfilesController } from './professional-profiles.controller';
import { ProfessionalProfilesService } from './professional-profiles.service';

@Module({
  controllers: [ProfessionalProfilesController],
  providers: [ProfessionalProfilesService],
})
export class ProfessionalProfilesModule {}
