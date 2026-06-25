import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpsertContentPageDto } from './content.dto';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Public()
  @Get('pages/:slug')
  findPage(@Param('slug') slug: string) {
    return this.service.findPublishedPage(slug);
  }

  @Public()
  @Get('faq')
  findFaq() {
    return this.service.findFaq();
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_content')
  @Post('pages')
  createPage(@Body() dto: UpsertContentPageDto) {
    return this.service.createPage(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_content')
  @Put('pages/:slug')
  updatePage(@Param('slug') slug: string, @Body() dto: UpsertContentPageDto) {
    return this.service.updatePage(slug, dto);
  }
}
