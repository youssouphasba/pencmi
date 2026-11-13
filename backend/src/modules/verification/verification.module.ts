import { Module } from '@nestjs/common';
import { FilesModule } from '../../files/files.module';
import { AdminVerificationController, VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [FilesModule],
  controllers: [VerificationController, AdminVerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
