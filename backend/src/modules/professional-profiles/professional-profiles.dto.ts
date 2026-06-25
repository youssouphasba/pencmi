import { IsEmail, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

const professionalTypes = [
  'real_estate_agency',
  'hotel',
  'auberge',
  'residence',
  'vehicle_renter',
  'vehicle_dealer',
  'chauffeur',
  'transport_provider',
  'other',
] as const;

export class UpsertProfessionalProfileDto {
  @IsIn(professionalTypes)
  professionalType: (typeof professionalTypes)[number];

  @IsString()
  businessName: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  professionalPhone?: string;

  @IsOptional()
  @IsEmail()
  professionalEmail?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}
