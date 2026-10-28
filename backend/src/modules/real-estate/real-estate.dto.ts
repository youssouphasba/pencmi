import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { MAX_LISTING_PHOTOS } from '../../files/listing-photo.constants';

export class RealEstateSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  transaction?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;
}

export class CreateRealEstateDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  transaction?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateRealEstateDto extends CreateRealEstateDto {}

export class PhotoOrderDto {
  @IsArray()
  @ArrayMaxSize(MAX_LISTING_PHOTOS)
  @ArrayUnique()
  @IsString({ each: true })
  photoIds: string[];
}

export class UploadListingPhotoDto {
  @IsUUID()
  uploadId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replacePhotoId?: string;
}

export class CreateVisitRequestDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

const visitRequestStatuses = [
  'pending',
  'accepted',
  'refused',
  'cancelled',
  'completed',
  'requires_more_info',
] as const;

export class UpdateVisitRequestStatusDto {
  @IsIn(visitRequestStatuses)
  status: (typeof visitRequestStatuses)[number];
}
