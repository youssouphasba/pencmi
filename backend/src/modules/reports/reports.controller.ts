import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateReportDto, HideReportedMessageDto, ReportListDto, UpdateReportStatusDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.service.create(user.id, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListDto) {
    return this.service.list('mine', user.id, query);
  }

  @RequirePermissions('manage_contacts')
  @Get('received')
  received(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListDto) {
    return this.service.list('received', user.id, query);
  }

  @RequirePermissions('manage_reports')
  @Get('admin')
  findAllAdmin(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportListDto) {
    return this.service.list('admin', user.id, query);
  }

  @RequirePermissions('manage_reports')
  @Get('admin/:id')
  findAdmin(@Param('id') id: string) {
    return this.service.findAdmin(id);
  }

  @RequirePermissions('manage_reports')
  @Patch('admin/:id/status')
  updateStatus(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateReportStatusDto) {
    return this.service.updateStatus(id, user.id, dto);
  }

  @RequirePermissions('manage_reports')
  @Patch('admin/:id/hide-message')
  hideMessage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: HideReportedMessageDto) {
    return this.service.hideMessage(id, user.id, dto.note);
  }
}
