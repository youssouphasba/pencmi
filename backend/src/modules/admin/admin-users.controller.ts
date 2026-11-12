import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AdminUserParams, AdminUserStatusDto } from './admin-users.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Patch(':id/status')
  setStatus(@Param() params: AdminUserParams, @Body() dto: AdminUserStatusDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.setStatus(params.id, admin.id, dto);
  }
}
