import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Matches } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { EmailVerificationService } from './email-verification.service';

export class ConfirmEmailDto {
  @Matches(/^[a-f0-9]{64}$/i)
  token: string;
}

@Controller('auth/email-verification')
export class EmailVerificationController {
  constructor(private readonly service: EmailVerificationService) {}

  @Public()
  @Get('capabilities')
  capabilities() { return this.service.capabilities(); }

  @Post('request')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  request(@CurrentUser() user: AuthenticatedUser) { return this.service.request(user.id); }

  @Public()
  @Post('confirm')
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  confirm(@Body() dto: ConfirmEmailDto) { return this.service.confirm(dto.token); }
}
