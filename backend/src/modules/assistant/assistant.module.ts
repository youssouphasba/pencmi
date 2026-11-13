import { Body, Controller, Get, Headers, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AssistantService } from './assistant.service';

@Controller('assistant')
class AssistantController {
  constructor(private readonly service: AssistantService) {}
  @Get('capabilities')
  capabilities(@CurrentUser() user: AuthenticatedUser) { return this.service.capabilities(user); }
  @Post('chat')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  chat(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown, @Headers('authorization') authorization: string) { return this.service.chat(user, body, authorization); }
  @Post('confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown, @Headers('authorization') authorization: string) { return this.service.confirm(user, body, authorization); }
}
@Module({ controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
