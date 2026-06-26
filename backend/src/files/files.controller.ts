import { Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { FilesService } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @Post('upload')
  createUploadPlaceholder(@CurrentUser() user: AuthenticatedUser) {
    return this.service.createUploadPlaceholder(user.id);
  }

  @Public()
  @Get('public/:id')
  async streamPublic(@Param('id') id: string, @Res() response: Response) {
    const { asset, buffer } = await this.service.streamPublicContent(id);
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', String(buffer.length));
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.send(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOwned(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(id, user.id);
  }
}
