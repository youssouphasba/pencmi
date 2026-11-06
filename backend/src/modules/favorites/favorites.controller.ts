import { Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoriteCheckDto, FavoriteListDto, FavoriteParamsDto } from './favorites.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: FavoriteListDto) {
    return this.service.list(user.id, query);
  }

  @Get('check')
  check(@CurrentUser() user: AuthenticatedUser, @Query() query: FavoriteCheckDto) {
    return this.service.check(user.id, query.module, query.ids);
  }

  @Put(':module/:listingId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  add(@CurrentUser() user: AuthenticatedUser, @Param() params: FavoriteParamsDto) {
    return this.service.add(user.id, params.module, params.listingId);
  }

  @Delete(':module/:listingId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  remove(@CurrentUser() user: AuthenticatedUser, @Param() params: FavoriteParamsDto) {
    return this.service.remove(user.id, params.module, params.listingId);
  }
}
