import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

export class TripSearchDto extends PaginationDto {
  @IsOptional()
  @IsString()
  departureCity?: string;

  @IsOptional()
  @IsString()
  arrivalCity?: string;
}

export class CreateTripDto {
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsString()
  vehicleType: string;

  @IsString()
  departureCity: string;

  @IsString()
  arrivalCity: string;

  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @IsString()
  departureTime?: string;
}

export class UpdateTripDto extends CreateTripDto {}

export class CreateSeatRequestDto {
  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestedSeats: number;

  @IsOptional()
  @IsBoolean()
  luggage?: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}

const seatRequestStatuses = ['pending', 'accepted', 'refused', 'cancelled', 'completed', 'requires_more_info'] as const;

export class UpdateSeatRequestStatusDto {
  @IsIn(seatRequestStatuses)
  status: (typeof seatRequestStatuses)[number];
}
