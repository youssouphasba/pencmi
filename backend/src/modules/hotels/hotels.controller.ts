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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  CreateHotelDto,
  CreateHotelReservationRequestDto,
  HotelSearchDto,
  UpdateHotelDto,
  UpdateHotelReservationStatusDto,
  HotelPhotoDto,
  HotelPhotoOrderDto,
} from './hotels.dto';
import { HotelsService } from './hotels.service';
import { HotelPublicationService } from './hotel-publication.service';
import { UploadedImage } from '../../files/files.service';
import { MAX_PHOTO_BYTES } from '../../files/listing-photo.constants';
import { Throttle } from '@nestjs/throttler';
import { HotelStayDto } from './hotels.dto';

@ApiTags('hotels')
@Controller()
export class HotelsController {
  constructor(
    private readonly service: HotelsService,
    private readonly publication: HotelPublicationService,
  ) {}

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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createReservationRequest(
    @Param('id') id: string,
    @Body() dto: CreateHotelReservationRequestDto,
  ) {
    return this.service.createReservationRequest(id, dto);
  }

  @Public()
  @Post('hotels/:id/stay-quote')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  quoteStay(@Param('id') id: string, @Body() dto: HotelStayDto) {
    return this.service.quoteStay(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Get('dashboard/hotels')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Get('dashboard/hotels/reservations')
  findMyReservationRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyReservationRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Patch('dashboard/hotels/reservations/:id/status')
  updateReservationStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHotelReservationStatusDto,
  ) {
    return this.service.updateReservationStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_hotel')
  @Post('dashboard/hotels')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHotelDto) {
    return this.publication.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Patch('dashboard/hotels/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHotelDto,
  ) {
    return this.publication.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Get('dashboard/hotels/:id')
  owned(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publication.owned(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Post('dashboard/hotels/:id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.publication.submit(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Post('dashboard/hotels/:id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: 1,
        fields: 3,
        fieldSize: 200,
      },
    }),
  )
  photo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HotelPhotoDto,
    @UploadedFile() photo: UploadedImage,
  ) {
    return this.publication.photo(user.id, id, dto, photo);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Patch('dashboard/hotels/:id/photos/order')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HotelPhotoOrderDto,
  ) {
    return this.publication.reorder(user.id, id, dto.photoIds);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Delete('dashboard/hotels/:id/photos/:photoId')
  removePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.publication.removePhoto(user.id, id, photoId);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_hotels')
  @Delete('dashboard/hotels/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
