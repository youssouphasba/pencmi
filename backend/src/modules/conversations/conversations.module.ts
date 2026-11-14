import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { RequesterMessagesController } from './requester-messages.controller';

@Module({
  controllers: [ConversationsController, RequesterMessagesController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
