import {
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
} from 'class-validator';

export const PASSWORD_POLICY = {
  minLength: 12,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
} as const;
export const PASSWORD_MAX_BYTES = 72;

export class ChangePasswordDto {
  @IsString()
  @MaxLength(1024)
  currentPassword: string;

  @IsString()
  @MaxLength(PASSWORD_MAX_BYTES)
  @IsStrongPassword(PASSWORD_POLICY)
  newPassword: string;
}

export class SessionIdDto {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}
