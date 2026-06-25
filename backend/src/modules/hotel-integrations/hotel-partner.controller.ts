import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PartnerUpsertPropertyDto } from './hotel-integrations.dto';
import { HotelIntegrationsService } from './hotel-integrations.service';

@ApiTags('hotel-partner')
@Public()
@Controller('api/hotel-partner/v1')
export class HotelPartnerController {
  constructor(private readonly service: HotelIntegrationsService) {}

  @Put('property/:externalPropertyId')
  upsertProperty(@Param('externalPropertyId') externalPropertyId: string, @Body() dto: PartnerUpsertPropertyDto) {
    return this.service.partnerUpsertProperty(externalPropertyId, dto);
  }

  @Get('property/:externalPropertyId')
  findProperty(@Param('externalPropertyId') externalPropertyId: string) {
    return this.service.partnerFindProperty(externalPropertyId);
  }

  @Get('events')
  findEvents() {
    return [];
  }
}
