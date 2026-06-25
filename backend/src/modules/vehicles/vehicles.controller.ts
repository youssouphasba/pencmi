import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateVehicleDto, CreateVehicleRequestDto, UpdateVehicleDto, VehicleSearchDto } from './vehicles.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@Controller()
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Public()
  @Get('voitures')
  findPublic(@Query() query: VehicleSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get('voitures/:id')
  findPublicOne(@Param('id') id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Post('voitures/:id/rental-requests')
  createRentalRequest(@Param('id') id: string, @Body() dto: CreateVehicleRequestDto) {
    return this.service.createRentalRequest(id, dto);
  }

  @Public()
  @Post('voitures/:id/chauffeur-requests')
  createChauffeurRequest(@Param('id') id: string, @Body() dto: CreateVehicleRequestDto) {
    return this.service.createChauffeurRequest(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_vehicle')
  @Post('dashboard/voitures')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVehicleDto) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Patch('dashboard/voitures/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.service.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Delete('dashboard/voitures/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
