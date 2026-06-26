import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateSeatRequestDto, CreateTripDto, TripSearchDto, UpdateSeatRequestStatusDto, UpdateTripDto } from './trips.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@Controller()
export class TripsController {
  constructor(private readonly service: TripsService) {}

  @Public()
  @Get('voyages')
  findPublic(@Query() query: TripSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get('voyages/:id')
  findPublicOne(@Param('id') id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Post('voyages/:id/seat-requests')
  createSeatRequest(@Param('id') id: string, @Body() dto: CreateSeatRequestDto) {
    return this.service.createSeatRequest(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_trips')
  @Get('dashboard/voyages')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_trips')
  @Get('dashboard/voyages/seat-requests')
  findMySeatRequests(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMySeatRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_trips')
  @Patch('dashboard/voyages/seat-requests/:id/status')
  updateSeatRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSeatRequestStatusDto,
  ) {
    return this.service.updateSeatRequestStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_trip')
  @Post('dashboard/voyages')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_trips')
  @Patch('dashboard/voyages/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.service.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_trips')
  @Delete('dashboard/voyages/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
