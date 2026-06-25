import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

export class VehicleSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  vehicleMode?: string;
}

export class CreateVehicleDto {
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsString()
  vehicleMode: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateVehicleDto extends CreateVehicleDto {}

export class CreateVehicleRequestDto {
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
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
