import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { LISTING_MODULES, ListingModule } from '../conversations/conversation-listings';

const LISTING_ID = /^[A-Za-z0-9_-]{1,80}$/;

export class FavoriteListDto extends PaginationDto {
  @IsOptional() @IsIn(LISTING_MODULES) module?: ListingModule;
}

export class FavoriteCheckDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @Matches(LISTING_ID, { each: true })
  ids: string[];
}

export class FavoriteParamsDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @IsString() @MaxLength(80) @Matches(LISTING_ID) listingId: string;
}
