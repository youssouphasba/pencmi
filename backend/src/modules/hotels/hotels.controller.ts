import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateHotelDto, CreateHotelReservationRequestDto, HotelSearchDto, UpdateHotelDto } from './hotels.dto';
import { HotelsService } from './hotels.service';

@ApiTags('hotels')
@Controller()
export class HotelsController {
  constructor(private readonly service: HotelsService) {}

  @Public()
  @Get('hotels')
  findPublic(@Query() query: HotelSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get('hotels/:id')
  findPublicOne(@Param('id') id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Post('hotels/:id/reservation-requests')
  createReservationRequest(@Param('id') id: string, @Body() dto: CreateHotelReservationRequestDto) {
    return this.service.createReservationRequest(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Get('dashboard/hotels')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Get('dashboard/hotels/reservations')
  findMyReservationRequests(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMyReservationRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_hotel')
  @Post('dashboard/hotels')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHotelDto) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Patch('dashboard/hotels/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateHotelDto) {
    return this.service.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Delete('dashboard/hotels/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
