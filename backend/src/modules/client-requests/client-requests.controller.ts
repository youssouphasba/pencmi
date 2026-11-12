import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  ClientRequestParamsDto,
  ClientRequestQueryDto,
} from './client-requests.dto';
import { ClientRequestsService } from './client-requests.service';

@ApiTags('client-requests')
@ApiBearerAuth()
@Controller('compte/requests')
export class ClientRequestsController {
  constructor(private readonly service: ClientRequestsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ClientRequestQueryDto,
  ) {
    return this.service.list(user.id, query);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.summary(user.id);
  }

  @Get(':type/:id')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ClientRequestParamsDto,
  ) {
    return this.service.findOne(user.id, params.type, params.id);
  }

  @Post(':type/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ClientRequestParamsDto,
  ) {
    return this.service.cancel(user.id, params.type, params.id);
  }
}
