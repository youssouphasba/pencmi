import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FilesModule } from '../../files/files.module';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [FilesModule],
  controllers: [AdminController, AdminListingsController, AdminUsersController],
  providers: [AdminService, AdminListingsService, AdminUsersService],
})
export class AdminModule {}
