import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AdminService } from './admin.service';
import { PaginationDto } from '../../common/pagination/pagination.dto';

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('users')
  users() {
    return this.service.users();
  }

  @Get('advertisers')
  advertisers() {
    return this.service.advertisers();
  }

  @Get('contacts')
  contacts(@Query() query: PaginationDto) { return this.service.contacts(query); }

  @Get('notifications')
  notifications(@Query() query: PaginationDto) { return this.service.notifications(query); }

  @Get('email-activity')
  emailActivity(@Query() query: PaginationDto) { return this.service.emailActivity(query); }

}
