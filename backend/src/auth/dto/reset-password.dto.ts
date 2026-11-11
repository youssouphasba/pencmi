import { IsString, IsStrongPassword, MaxLength } from 'class-validator';
import { PASSWORD_POLICY, PASSWORD_MAX_BYTES } from './account-security.dto';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  token: string;

  @IsString()
  @MaxLength(PASSWORD_MAX_BYTES)
  @IsStrongPassword(PASSWORD_POLICY)
  password: string;
}
