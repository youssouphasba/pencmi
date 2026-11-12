import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailVerificationController } from './email-verification.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, EmailVerificationController],
  providers: [AuthService, EmailVerificationService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
