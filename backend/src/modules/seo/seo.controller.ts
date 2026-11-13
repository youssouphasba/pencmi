import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SaveSeoMetaDto, SeoIdParams, SeoPathQuery } from './seo.dto';
import { SeoService } from './seo.service';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly service: SeoService) {}

  /** The admin override of a public page, or null: the page then keeps its built-in title. */
  @Public()
  @Get('meta')
  findMeta(@Query() query: SeoPathQuery) {
    return this.service.findMeta(query.path ?? '/');
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('manage_content')
@Controller('admin/seo/meta')
export class AdminSeoController {
  constructor(private readonly service: SeoService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Put()
  save(@Body() dto: SaveSeoMetaDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.save(admin.id, dto);
  }

  @Delete(':id')
  remove(@Param() params: SeoIdParams, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.remove(admin.id, params.id);
  }
}
