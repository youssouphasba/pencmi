import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ArrayMaxSize,
  ArrayUnique,
  Matches,
  IsEmail,
  MinLength,
  Max,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

export class HotelSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  stars?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  amenity?: string;

  // Stay search: both dates are required together (checked in the service).
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  guests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rooms?: number;
}

export class CreateHotelDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  rooms?: unknown[];
}

export class UpdateHotelDto extends CreateHotelDto {}

export class HotelPhotoDto {
  @IsUUID()
  uploadId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  roomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replacePhotoId?: string;
}

export class HotelPhotoOrderDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  photoIds: string[];
}

export class HotelStayDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  roomId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut: string;

  @IsInt()
  @Min(1)
  @Max(100)
  guests: number;

  @IsInt()
  @Min(1)
  @Max(10)
  units: number;
}

export class CreateHotelReservationRequestDto extends HotelStayDto {
  @IsUUID()
  requestId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clientName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  clientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

const hotelReservationStatuses = [
  'pending',
  'accepted',
  'refused',
  'cancelled',
  'requires_more_info',
  'expired',
  'completed',
] as const;

export class UpdateHotelReservationStatusDto {
  @IsIn(hotelReservationStatuses)
  status: (typeof hotelReservationStatuses)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
