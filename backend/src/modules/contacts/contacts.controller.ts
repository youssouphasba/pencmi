import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { ContactListDto, ContactsService } from './contacts.service';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('dashboard/contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() query: ContactListDto) {
    return this.service.findMine(user.id, query);
  }
}
