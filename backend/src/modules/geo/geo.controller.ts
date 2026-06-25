import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly service: GeoService) {}

  @Public()
  @Get('entities')
  findPublicEntities() {
    return this.service.findPublicEntities();
  }
}
