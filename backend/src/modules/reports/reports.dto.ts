import { IsIn, IsOptional, IsString } from 'class-validator';

const modules = ['real_estate', 'hotels', 'vehicles', 'trips', 'messages', 'users', 'system'] as const;
const targetTypes = ['listing', 'user', 'advertiser', 'message', 'conversation', 'document', 'other'] as const;
const reportStatuses = ['new', 'in_progress', 'correction_requested', 'resolved', 'rejected', 'archived'] as const;

export class CreateReportDto {
  @IsIn(modules)
  module: (typeof modules)[number];

  @IsIn(targetTypes)
  targetType: (typeof targetTypes)[number];

  @IsString()
  targetId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateReportStatusDto {
  @IsIn(reportStatuses)
  status: (typeof reportStatuses)[number];
}
