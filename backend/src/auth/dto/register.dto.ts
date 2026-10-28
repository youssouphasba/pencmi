import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PUBLIC_REGISTRATION_ROLES, PublicRegistrationRole } from '../../common/constants/roles';

export class RegisterDto {
  @IsIn(PUBLIC_REGISTRATION_ROLES)
  role: PublicRegistrationRole;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
