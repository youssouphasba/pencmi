import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { LISTING_MODULES, ListingModule } from '../conversations/conversation-listings';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SavedAlertListDto extends PaginationDto {
  @IsOptional() @IsIn(LISTING_MODULES) module?: ListingModule;
}

export class CreateSavedAlertDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @Transform(trimmed) @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsObject() filters: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateSavedAlertDto {
  @IsOptional() @Transform(trimmed) @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
  @IsOptional() @IsBoolean() active?: boolean;
}
