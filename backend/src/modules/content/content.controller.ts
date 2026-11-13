import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ContentIdParams, ContentSlugParams, ContentVersionParams, SaveContentPageDto, SaveFaqItemDto } from './content.dto';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  /** Null until an admin publishes the page: the site then shows its default text. */
  @Public()
  @Get('pages/:slug')
  findPage(@Param() params: ContentSlugParams) {
    return this.service.findPublishedPage(params.slug);
  }

  @Public()
  @Get('faq')
  findFaq() {
    return this.service.findFaq();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('manage_content')
@Controller('admin/content')
export class AdminContentController {
  constructor(private readonly service: ContentService) {}

  @Get('pages')
  pages() {
    return this.service.adminPages();
  }

  @Get('pages/:slug')
  page(@Param() params: ContentSlugParams) {
    return this.service.adminPage(params.slug);
  }

  @Put('pages/:slug')
  save(@Param() params: ContentSlugParams, @Body() dto: SaveContentPageDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.savePage(admin.id, params.slug, dto);
  }

  @Get('pages/:slug/versions/:versionId')
  version(@Param() params: ContentVersionParams) {
    return this.service.versionSnapshot(params.slug, params.versionId);
  }

  @Get('faq')
  faq() {
    return this.service.adminFaq();
  }

  @Post('faq')
  createFaq(@Body() dto: SaveFaqItemDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.createFaq(admin.id, dto);
  }

  @Patch('faq/:id')
  updateFaq(@Param() params: ContentIdParams, @Body() dto: SaveFaqItemDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.updateFaq(admin.id, params.id, dto);
  }

  @Delete('faq/:id')
  deleteFaq(@Param() params: ContentIdParams, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.deleteFaq(admin.id, params.id);
  }
}
