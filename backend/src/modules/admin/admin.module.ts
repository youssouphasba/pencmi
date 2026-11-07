import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FilesModule } from '../../files/files.module';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';

@Module({
  imports: [FilesModule],
  controllers: [AdminController, AdminListingsController],
  providers: [AdminService, AdminListingsService],
})
export class AdminModule {}
