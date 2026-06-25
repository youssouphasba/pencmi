import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('dashboard/stats')
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get()
  findDashboardStats(@CurrentUser() user: AuthenticatedUser, @Query('module') module?: string) {
    return this.service.findDashboardStats(user.id, module);
  }
}
