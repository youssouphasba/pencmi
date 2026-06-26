import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const reviewModules = ['real_estate', 'hotels', 'vehicles', 'trips'] as const;
const targetTypes = ['listing', 'advertiser', 'other'] as const;
const reviewStatuses = ['pending_review', 'published', 'rejected', 'archived'] as const;

export class CreateAdvertiserReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  comment?: string;

  @IsOptional()
  @IsIn(reviewModules)
  module?: (typeof reviewModules)[number];

  @IsOptional()
  @IsIn(targetTypes)
  targetType?: (typeof targetTypes)[number];

  @IsOptional()
  @IsString()
  targetId?: string;
}

export class UpdateAdvertiserReviewStatusDto {
  @IsIn(reviewStatuses)
  status: (typeof reviewStatuses)[number];
}
