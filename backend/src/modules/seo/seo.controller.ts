import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SeoService } from './seo.service';

@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(private readonly service: SeoService) {}

  @Public()
  @Get('meta')
  findMeta(@Query('path') path = '/') {
    return this.service.findMeta(path);
  }
}
