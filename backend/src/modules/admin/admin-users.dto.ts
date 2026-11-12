import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const ADMIN_USER_STATUSES = ['active', 'suspended'] as const;

export class AdminUserParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}

export class AdminUserStatusDto {
  @IsIn(ADMIN_USER_STATUSES)
  status: (typeof ADMIN_USER_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
