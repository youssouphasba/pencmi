import { Body, Controller, Get, Headers, Ip, Module, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuthentication, Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AssistantService } from './assistant.service';

@Controller('assistant')
class AssistantController {
  constructor(private readonly service: AssistantService) {}
  // Visitors may talk to Guindi; a valid token, when sent, still identifies the account.
  @Public()
  @OptionalAuthentication()
  @Get('capabilities')
  capabilities(@CurrentUser() user: AuthenticatedUser | undefined, @Ip() ip: string) { return this.service.capabilities(user ?? this.service.visitor(ip)); }
  @Public()
  @OptionalAuthentication()
  @Post('chat')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  chat(@CurrentUser() user: AuthenticatedUser | undefined, @Ip() ip: string, @Body() body: unknown, @Headers('authorization') authorization: string) {
    return this.service.chat(user ?? this.service.visitor(ip), body, user ? authorization : '');
  }
  // Confirming an action always requires a signed-in account.
  @Post('confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown, @Headers('authorization') authorization: string) { return this.service.confirm(user, body, authorization); }
}
@Module({ controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
