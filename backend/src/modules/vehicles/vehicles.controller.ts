import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  CreateVehicleDto,
  CreateVehicleRequestDto,
  UpdateVehicleDto,
  UpdateVehicleRequestStatusDto,
  VehicleSearchDto,
  VehiclePhotoDto,
  VehiclePhotoOrderDto,
} from './vehicles.dto';
import { VehiclesService } from './vehicles.service';
import { VehiclePublicationService } from './vehicle-publication.service';
import { UploadedImage } from '../../files/files.service';
import { MAX_PHOTO_BYTES } from '../../files/listing-photo.constants';

@ApiTags('vehicles')
@Controller()
export class VehiclesController {
  constructor(
    private readonly service: VehiclesService,
    private readonly publication: VehiclePublicationService,
  ) {}

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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createRentalRequest(
    @Param('id') id: string,
    @Body() dto: CreateVehicleRequestDto,
  ) {
    return this.service.createRentalRequest(id, dto);
  }

  @Public()
  @Post('voitures/:id/chauffeur-requests')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createChauffeurRequest(
    @Param('id') id: string,
    @Body() dto: CreateVehicleRequestDto,
  ) {
    return this.service.createChauffeurRequest(id, dto);
  }

  @Public()
  @Post('voitures/:id/contact')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createContact(@Param('id') id: string, @Body() dto: CreateVehicleRequestDto) {
    return this.service.createContact(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures/rental-requests')
  findMyRentalRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyRentalRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures/chauffeur-requests')
  findMyChauffeurRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyChauffeurRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Patch('dashboard/voitures/rental-requests/:id/status')
  updateRentalRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleRequestStatusDto,
  ) {
    return this.service.updateRentalRequestStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Patch('dashboard/voitures/chauffeur-requests/:id/status')
  updateChauffeurRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleRequestStatusDto,
  ) {
    return this.service.updateChauffeurRequestStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_vehicle')
  @Post('dashboard/voitures')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.publication.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Patch('dashboard/voitures/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.publication.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures/:id')
  findOwned(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publication.findOwned(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Post('dashboard/voitures/:id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publication.submit(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Post('dashboard/voitures/:id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 2 },
    }),
  )
  photo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VehiclePhotoDto,
    @UploadedFile() file: UploadedImage,
  ) {
    return this.publication.photo(user.id, id, dto, file);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Patch('dashboard/voitures/:id/photos/order')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VehiclePhotoOrderDto,
  ) {
    return this.publication.reorder(user.id, id, dto.photoIds);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Delete('dashboard/voitures/:id/photos/:photoId')
  removePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.publication.removePhoto(user.id, id, photoId);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Delete('dashboard/voitures/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
