import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  Min,
  Max,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import {
  VEHICLE_MODES,
  VEHICLE_PHOTO_LIMIT,
} from './vehicle-publication.schema';

export class VehicleSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @IsOptional()
  @IsIn(VEHICLE_MODES)
  vehicleMode?: string;

  @IsOptional() @IsString() @MaxLength(200) query?: string;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
  @IsOptional() @IsString() @MaxLength(60) fuel?: string;
  @IsOptional() @IsString() @MaxLength(60) gearbox?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxPrice?: number;
}

export class CreateVehicleDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(VEHICLE_MODES)
  vehicleMode?: (typeof VEHICLE_MODES)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  description?: string;
}

export class UpdateVehicleDto extends CreateVehicleDto {}

export class VehiclePhotoDto {
  @IsUUID()
  uploadId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replacePhotoId?: string;
}
export class VehiclePhotoOrderDto {
  @IsArray()
  @ArrayMaxSize(VEHICLE_PHOTO_LIMIT)
  @ArrayUnique()
  @IsString({ each: true })
  photoIds: string[];
}

export class CreateVehicleRequestDto {
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
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

const vehicleRequestStatuses = [
  'pending',
  'accepted',
  'refused',
  'cancelled',
  'completed',
  'requires_more_info',
] as const;

export class UpdateVehicleRequestStatusDto {
  @IsIn(vehicleRequestStatuses)
  status: (typeof vehicleRequestStatuses)[number];
}
