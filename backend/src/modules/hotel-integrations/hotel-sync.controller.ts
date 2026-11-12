import { Body, Controller, createParamDecorator, Delete, ExecutionContext, Get, Header, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { HotelChannelGuard, HotelChannelRequest } from './hotel-channel.guard';
import { HotelChannelPartnerContext, HotelSyncService } from './hotel-sync.service';

const CurrentChannelPartner = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<HotelChannelRequest>().channelPartner,
);

/** Synchronisation settings of the hotelier: calendars and channel manager. */
@ApiTags('hotel-integrations')
@ApiBearerAuth()
@RequirePermissions('manage_hotels')
@Controller('dashboard/hotels/integrations/:propertyId/sync')
export class HotelSyncController {
  constructor(private readonly service: HotelSyncService) {}

  @Get()
  view(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.service.view(user.id, propertyId);
  }

  @Put()
  update(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Body() body: unknown) {
    return this.service.updateSettings(user.id, propertyId, body);
  }

  @Post('rooms/:roomId/ical-export')
  createExport(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('roomId') roomId: string) {
    return this.service.createIcalExport(user.id, propertyId, roomId);
  }

  @Delete('rooms/:roomId/ical-export')
  deleteExport(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('roomId') roomId: string) {
    return this.service.deleteIcalExport(user.id, propertyId, roomId);
  }

  @Post('rooms/:roomId/ical-imports')
  addImport(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('roomId') roomId: string, @Body() body: unknown) {
    return this.service.addIcalImport(user.id, propertyId, roomId, body);
  }

  @Delete('ical-imports/:importId')
  deleteImport(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Param('importId') importId: string) {
    return this.service.deleteIcalImport(user.id, propertyId, importId);
  }
}

/** The calendar a hotel software subscribes to. The secret link is the only credential. */
@ApiTags('hotel-integrations')
@Public()
@Controller('hotel-calendars')
export class HotelCalendarController {
  constructor(private readonly service: HotelSyncService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  async calendar(@Param('token') token: string, @Res() response: Response) {
    const body = await this.service.exportCalendar(token);
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader('Content-Disposition', 'inline; filename="pencmi.ics"');
    response.send(body);
  }
}

/**
 * Channel manager API: rooms, availability and rates in, reservations out. One partner
 * credential serves every hotel that selected that partner in its Pencmi settings.
 */
@ApiTags('channel-manager')
@ApiSecurity('channel-manager')
@Public()
@Throttle({ default: { limit: 1200, ttl: 60000 } })
@UseGuards(HotelChannelGuard)
@Controller('channel-manager/hotels/:hotelCode')
export class HotelChannelController {
  constructor(private readonly service: HotelSyncService) {}

  @Get('rooms')
  rooms(@CurrentChannelPartner() partner: HotelChannelPartnerContext, @Param('hotelCode') hotelCode: string) {
    return this.service.channelRooms(partner, hotelCode);
  }

  @Post('inventory')
  inventory(@CurrentChannelPartner() partner: HotelChannelPartnerContext, @Param('hotelCode') hotelCode: string, @Body() body: unknown) {
    return this.service.channelInventory(partner, hotelCode, body);
  }

  @Get('reservations')
  reservations(@CurrentChannelPartner() partner: HotelChannelPartnerContext, @Param('hotelCode') hotelCode: string) {
    return this.service.channelReservations(partner, hotelCode);
  }

  @Post('reservations/ack')
  acknowledge(@CurrentChannelPartner() partner: HotelChannelPartnerContext, @Param('hotelCode') hotelCode: string, @Body() body: unknown) {
    return this.service.channelAcknowledge(partner, hotelCode, body);
  }
}
