import { IsString } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  body: string;
}
