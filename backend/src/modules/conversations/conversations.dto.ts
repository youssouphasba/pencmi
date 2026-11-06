import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
} from "class-validator";
import { Transform } from "class-transformer";

export class CreateMessageDto {
  @IsOptional() @IsUUID() requestId?: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  body: string;
}
