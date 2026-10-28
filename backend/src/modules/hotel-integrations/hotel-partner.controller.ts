import { Body, Controller, Get, NotImplementedException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PartnerUpsertPropertyDto } from './hotel-integrations.dto';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { CurrentHotelPartner, HotelPartnerContext, RequireHotelPartnerPermission } from './hotel-partner-auth';
import { HotelPartnerGuard } from './hotel-partner.guard';

@ApiTags('hotel-partner')
@ApiSecurity('hotel-partner-key')
@Public()
@UseGuards(HotelPartnerGuard)
@Controller('api/hotel-partner/v1')
export class HotelPartnerController {
  constructor(private readonly service: HotelIntegrationsService) {}

  @Put('property/:externalPropertyId')
  @RequireHotelPartnerPermission('hotel.property.write')
  upsertProperty(@CurrentHotelPartner() partner: HotelPartnerContext, @Param('externalPropertyId') externalPropertyId: string, @Body() dto: PartnerUpsertPropertyDto) {
    return this.service.partnerUpsertProperty(partner, externalPropertyId, dto);
  }

  @Get('property/:externalPropertyId')
  @RequireHotelPartnerPermission('hotel.property.read')
  findProperty(@CurrentHotelPartner() partner: HotelPartnerContext, @Param('externalPropertyId') externalPropertyId: string) {
    return this.service.partnerFindProperty(partner, externalPropertyId);
  }

  @Get('events')
  @RequireHotelPartnerPermission('hotel.requests.read')
  findEvents() {
    throw new NotImplementedException('Le flux d’événements partenaire est indisponible.');
  }
}
