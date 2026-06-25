import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UpsertProfessionalProfileDto } from './professional-profiles.dto';
import { ProfessionalProfilesService } from './professional-profiles.service';

@ApiTags('professional-profiles')
@ApiBearerAuth()
@Controller('professional-profiles')
export class ProfessionalProfilesController {
  constructor(private readonly service: ProfessionalProfilesService) {}

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user.id);
  }

  @Put('me')
  upsertMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertProfessionalProfileDto) {
    return this.service.upsertMine(user.id, dto);
  }
}
