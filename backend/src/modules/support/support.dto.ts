import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';
import { PaginationDto } from '../../common/pagination/pagination.dto';
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

export class SupportQueueDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;
}

export class UpdateSupportTicketDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}
