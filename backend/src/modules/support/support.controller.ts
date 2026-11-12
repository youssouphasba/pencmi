import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateSupportMessageDto, CreateSupportTicketDto, SupportQueueDto, UpdateSupportTicketDto } from './support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Public()
  @Get('categories')
  findCategories() {
    return this.service.findCategories();
  }

  @ApiBearerAuth()
  @Post('tickets')
  createTicket(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupportTicketDto) {
    return this.service.createTicket(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('tickets')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user.id);
  }

  @ApiBearerAuth()
  @Post('tickets/:id/messages')
  createMessage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupportMessageDto) {
    return this.service.createMessage(id, user.id, dto);
  }

  @RequirePermissions('access_admin')
  @Get('admin/tickets')
  queue(@Query() query: SupportQueueDto) { return this.service.queue(query); }

  @RequirePermissions('access_admin')
  @Get('admin/tickets/:id')
  detail(@Param('id') id: string) { return this.service.adminDetail(id); }

  @RequirePermissions('access_admin')
  @Post('admin/tickets/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  reply(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupportMessageDto) {
    return this.service.adminReply(id, user.id, dto);
  }

  @RequirePermissions('access_admin')
  @Patch('admin/tickets/:id/status')
  update(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSupportTicketDto) {
    return this.service.adminStatus(id, user.id, dto.status);
  }
}
