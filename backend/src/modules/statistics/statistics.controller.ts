import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { StatisticsLegacyDto, StatisticsReportDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@RequirePermissions('manage_contacts')
@Controller('dashboard/stats')
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get()
  findDashboardStats(@CurrentUser() user: AuthenticatedUser, @Query() query: StatisticsLegacyDto) {
    return this.service.findDashboardStats(user.id, query.module);
  }

  @Get('report')
  report(@CurrentUser() user: AuthenticatedUser, @Query() query: StatisticsReportDto) {
    return this.service.report(user, query);
  }
}
