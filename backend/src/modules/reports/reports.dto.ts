import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';

export const reportModules = ['real_estate', 'hotels', 'vehicles', 'trips', 'messages', 'users', 'system'] as const;
export const reportTargets = ['listing', 'user', 'advertiser', 'message', 'conversation', 'other'] as const;
export const reportStatuses = ['new', 'in_progress', 'correction_requested', 'resolved', 'rejected', 'archived'] as const;
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateReportDto {
  @IsIn(reportModules)
  module: (typeof reportModules)[number];

  @IsIn(reportTargets)
  targetType: (typeof reportTargets)[number];

  @Matches(/^[\w-]{1,128}$/)
  targetId: string;

  @Matches(/^[a-z][a-z0-9_]{0,79}$/)
  reason: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class HideReportedMessageDto {
  @Transform(trim)
  @Matches(/\S/)
  @MaxLength(1000)
  note: string;
}

export class UpdateReportStatusDto extends HideReportedMessageDto {
  @IsIn(reportStatuses)
  status: (typeof reportStatuses)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  messageToAdvertiser?: string;
}

export class ReportListDto extends PaginationDto {
  @IsOptional()
  @IsIn(reportStatuses)
  status?: (typeof reportStatuses)[number];

  @IsOptional()
  @IsIn(reportModules)
  module?: (typeof reportModules)[number];

  @IsOptional()
  @IsIn(reportTargets)
  targetType?: (typeof reportTargets)[number];
}
