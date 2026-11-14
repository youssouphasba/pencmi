import { Body, Controller, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ConversationsService, REQUESTER_TYPES, RequesterType } from './conversations.service';

class RequesterMessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) body: string;
  @IsUUID() requestId: string;
}

/** "Écrire au client" from any request an advertiser received (visit, hotel, rental, chauffeur, trip). */
@ApiTags('messages')
@ApiBearerAuth()
@Controller('dashboard/requests')
export class RequesterMessagesController {
  constructor(private readonly service: ConversationsService) {}

  @Post(':type/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  write(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(Object.fromEntries(REQUESTER_TYPES.map((type) => [type, type])))) type: RequesterType,
    @Param('id') id: string,
    @Body() dto: RequesterMessageDto,
  ) {
    return this.service.messageRequester(user.id, type, id, dto.body, dto.requestId);
  }
}
