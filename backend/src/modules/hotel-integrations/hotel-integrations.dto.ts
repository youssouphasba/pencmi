import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateHotelApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  permissions: string[];
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
