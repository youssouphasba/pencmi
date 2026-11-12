import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['true'])
  furnished?: 'true';
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
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  clientEmail?: string;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
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
