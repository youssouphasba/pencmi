import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const profileText = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').normalize('NFC') || null
    : value;

export class UpdateUserProfileDto {
  @IsOptional()
  @Transform(profileText)
  @IsString()
  @MaxLength(100)
  @Matches(/^[^\u0000-\u001f\u007f]*$/u)
  firstName?: string | null;

  @IsOptional()
  @Transform(profileText)
  @IsString()
  @MaxLength(100)
  @Matches(/^[^\u0000-\u001f\u007f]*$/u)
  lastName?: string | null;

  @IsOptional()
  @Transform(profileText)
  @IsString()
  @MaxLength(150)
  @Matches(/^[^\u0000-\u001f\u007f]*$/u)
  city?: string | null;
}
