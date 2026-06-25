import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { EmailsService } from './emails.service';

@ApiTags('emails')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin/emails')
export class EmailsController {
  constructor(private readonly service: EmailsService) {}

  @Get('logs')
  findLogs() {
    return this.service.findLogs();
  }

  @Get('templates')
  findTemplates() {
    return this.service.findTemplates();
  }
}
