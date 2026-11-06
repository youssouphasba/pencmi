import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  ConversationByListingDto,
  ConversationListDto,
  ConversationMessagesDto,
  CreateMessageDto,
  OpenConversationDto,
} from './conversations.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('messages/conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: ConversationListDto) {
    return this.service.findMine(user.id, query);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenConversationDto) {
    return this.service.open(user.id, dto);
  }

  @Get('by-listing')
  findForListing(@CurrentUser() user: AuthenticatedUser, @Query() query: ConversationByListingDto) {
    return this.service.findForListing(user.id, query.module, query.listingId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Query() query: ConversationMessagesDto) {
    return this.service.findOne(id, user.id, query);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createMessage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMessageDto) {
    return this.service.createMessage(id, user.id, dto);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markRead(id, user.id);
  }
}
