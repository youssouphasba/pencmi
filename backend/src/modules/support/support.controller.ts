import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateSupportMessageDto, CreateSupportTicketDto } from './support.dto';
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
}
