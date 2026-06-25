import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertContentPageDto {
  @IsString()
  slug: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsArray()
  sections?: Array<{ key: string; content: unknown; position?: number }>;
}
