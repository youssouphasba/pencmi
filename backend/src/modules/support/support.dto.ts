import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SUPPORT_TEXT_LIMITS } from './support.constants';

export class CreateSupportMessageDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(SUPPORT_TEXT_LIMITS.body)
  body: string;
}

export class CreateSupportTicketDto extends CreateSupportMessageDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(SUPPORT_TEXT_LIMITS.subject)
  subject: string;
}
