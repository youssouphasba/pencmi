import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FilesModule } from '../../files/files.module';
import { AdminListingsController } from './admin-listings.controller';
import { AdminListingsService } from './admin-listings.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminStatisticsController, AdminStatisticsService } from './admin-statistics';

@Module({
  imports: [FilesModule],
  controllers: [AdminController, AdminListingsController, AdminUsersController, AdminStatisticsController],
  providers: [AdminService, AdminListingsService, AdminUsersService, AdminStatisticsService],
})
export class AdminModule {}
