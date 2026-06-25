import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const modules = ['real_estate', 'hotels', 'vehicles', 'trips', 'messages', 'users', 'content', 'support', 'system'] as const;
const targetTypes = ['listing', 'user', 'advertiser', 'message', 'conversation', 'document', 'other'] as const;

export class CreateTrackingEventDto {
  @IsIn(modules)
  module: (typeof modules)[number];

  @IsString()
  eventType: string;

  @IsOptional()
  @IsIn(targetTypes)
  targetType?: (typeof targetTypes)[number];

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
