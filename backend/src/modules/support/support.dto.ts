import { IsOptional, IsString } from 'class-validator';

export class CreateSupportTicketDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}

export class CreateSupportMessageDto {
  @IsString()
  body: string;
}
