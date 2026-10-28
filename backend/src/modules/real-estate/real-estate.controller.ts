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
  CreateRealEstateDto,
  CreateVisitRequestDto,
  PhotoOrderDto,
  RealEstateSearchDto,
  UpdateRealEstateDto,
  UpdateVisitRequestStatusDto,
  UploadListingPhotoDto,
} from './real-estate.dto';
import { UploadedImage } from '../../files/files.service';
import { MAX_PHOTO_BYTES } from './publication.schema';
import { RealEstateService } from './real-estate.service';

@ApiTags('real-estate')
@Controller()
export class RealEstateController {
  constructor(private readonly service: RealEstateService) {}

  @Public()
  @Get('immobilier')
  findPublic(@Query() query: RealEstateSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get('immobilier/:id')
  findPublicOne(@Param('id') id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Post('immobilier/:id/visit-requests')
  createVisitRequest(
    @Param('id') id: string,
    @Body() dto: CreateVisitRequestDto,
  ) {
    return this.service.createVisitRequest(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Get('dashboard/immobilier')
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Get('dashboard/immobilier/visits')
  findMyVisitRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMyVisitRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Patch('dashboard/immobilier/visits/:id/status')
  updateVisitRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVisitRequestStatusDto,
  ) {
    return this.service.updateVisitRequestStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_real_estate')
  @Post('dashboard/immobilier')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRealEstateDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Get('dashboard/immobilier/:id')
  findOwned(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findOwned(user.id, id);
  }

  @RequirePermissions('manage_real_estate')
  @Post('dashboard/immobilier/:id/submit')
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.submit(user.id, id);
  }

  @RequirePermissions('manage_real_estate')
  @Post('dashboard/immobilier/:id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: {
        fileSize: MAX_PHOTO_BYTES,
        files: 1,
        fields: 2,
        fieldSize: 200,
      },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UploadListingPhotoDto,
    @UploadedFile() photo: UploadedImage,
  ) {
    return this.service.uploadPhoto(
      user.id,
      id,
      dto.uploadId,
      photo,
      dto.replacePhotoId,
    );
  }

  @RequirePermissions('manage_real_estate')
  @Patch('dashboard/immobilier/:id/photos/order')
  orderPhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PhotoOrderDto,
  ) {
    return this.service.orderPhotos(user.id, id, dto.photoIds);
  }

  @RequirePermissions('manage_real_estate')
  @Delete('dashboard/immobilier/:id/photos/:photoId')
  deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.service.deletePhoto(user.id, id, photoId);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Patch('dashboard/immobilier/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRealEstateDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Delete('dashboard/immobilier/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}
