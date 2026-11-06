import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { CreateSavedAlertDto, SavedAlertListDto, UpdateSavedAlertDto } from './saved-alerts.dto';
import { SavedAlertsService } from './saved-alerts.service';

@ApiTags('saved-alerts')
@ApiBearerAuth()
@Controller('saved-alerts')
export class SavedAlertsController {
  constructor(private readonly service: SavedAlertsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: SavedAlertListDto) {
    return this.service.list(user.id, query);
  }

  @Get('capabilities')
  capabilities() {
    return this.service.capabilities();
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSavedAlertDto) {
    return this.service.create(user.id, dto);
  }

  @Get(':id/matches')
  matches(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query() query: PaginationDto) {
    return this.service.matches(user.id, id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSavedAlertDto) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
