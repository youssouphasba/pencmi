import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { VERIFICATION_DECISIONS, VerificationDecision } from './verification.constants';

export const VERIFICATION_LIST_STATUSES = ['pending', 'accepted', 'refused', 'requires_more_info', 'cancelled'] as const;

export class VerificationIdParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}

export class VerificationDocumentParams extends VerificationIdParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  documentId: string;
}

export class VerificationUserParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  userId: string;
}

export class AdminVerificationQuery {
  @IsOptional()
  @IsIn(VERIFICATION_LIST_STATUSES)
  status?: (typeof VERIFICATION_LIST_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class VerificationDecisionDto {
  @IsIn(VERIFICATION_DECISIONS)
  decision: VerificationDecision;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class VerificationRevokeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason: string;
}
