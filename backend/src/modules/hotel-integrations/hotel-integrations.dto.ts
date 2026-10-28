import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { HOTEL_PARTNER_PERMISSIONS, HotelPartnerPermission } from './hotel-partner-auth';

export class CreateHotelApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(HOTEL_PARTNER_PERMISSIONS, { each: true })
  permissions: HotelPartnerPermission[];
}

export class CreateHotelWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  events: string[];
}

export class PartnerUpsertPropertyDto {
  @IsString()
  name: string;

  @IsString()
  propertyType: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  region?: string;
}
