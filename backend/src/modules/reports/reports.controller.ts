import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateReportDto, UpdateReportStatusDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.service.create(user.id, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user.id);
  }

  @RequirePermissions('manage_reports')
  @Get('admin')
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @RequirePermissions('manage_reports')
  @Patch('admin/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReportStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
