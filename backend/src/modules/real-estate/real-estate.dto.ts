import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

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
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsString()
  city: string;

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
  @IsString()
  neighborhood?: string;
}

export class UpdateRealEstateDto extends CreateRealEstateDto {}

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

const visitRequestStatuses = ['pending', 'accepted', 'refused', 'cancelled', 'completed', 'requires_more_info'] as const;

export class UpdateVisitRequestStatusDto {
  @IsIn(visitRequestStatuses)
  status: (typeof visitRequestStatuses)[number];
}
