import { Body, Controller, Get, Headers, Module, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuthentication, Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { AssistantService } from './assistant.service';

/**
 * Best-effort visitor address for Guindi's free-question allowance only. Railway publishes no
 * proxy ranges (see docs/security-dependencies.md), so the app-wide limiter keeps the socket IP;
 * here we read the edge's X-Real-IP, then the last X-Forwarded-For hop. A global daily cap on
 * visitor calls bounds the cost if these headers were ever spoofed.
 */
function visitorAddress(request: Request) {
  const real = String(request.headers['x-real-ip'] ?? '').trim();
  const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',').map(v => v.trim()).filter(Boolean).pop();
  return real || forwarded || request.ip || 'unknown';
}

@Controller('assistant')
class AssistantController {
  constructor(private readonly service: AssistantService) {}
  // Visitors may talk to Guindi; a valid token, when sent, still identifies the account.
  @Public()
  @OptionalAuthentication()
  @Get('capabilities')
  capabilities(@CurrentUser() user: AuthenticatedUser | undefined, @Req() request: Request) { return this.service.capabilities(user ?? this.service.visitor(visitorAddress(request))); }
  @Public()
  @OptionalAuthentication()
  @Post('chat')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  chat(@CurrentUser() user: AuthenticatedUser | undefined, @Req() request: Request, @Body() body: unknown, @Headers('authorization') authorization: string) {
    return this.service.chat(user ?? this.service.visitor(visitorAddress(request)), body, user ? authorization : '');
  }
  // Confirming an action always requires a signed-in account.
  @Post('confirm')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown, @Headers('authorization') authorization: string) { return this.service.confirm(user, body, authorization); }
}
@Module({ controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
