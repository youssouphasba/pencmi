import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  IsInt,
  Max,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { PaginationDto } from "../../common/pagination/pagination.dto";
import { LISTING_MODULES, ListingModule } from "./conversation-listings";

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateMessageDto {
  @IsOptional() @IsUUID() requestId?: string;
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  body: string;
}

export class OpenConversationDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @IsString() @MinLength(1) @MaxLength(80) listingId: string;
  // Required here: opening must stay safe to retry after a lost response.
  @IsUUID() requestId: string;
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(6000)
  body: string;
}

export class ConversationByListingDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @IsString() @MinLength(1) @MaxLength(80) listingId: string;
}

export class ConversationListDto extends PaginationDto {
  @IsOptional() @IsIn(["participant", "owner"]) scope?: "participant" | "owner";
  // The advertiser inbox is always one universe.
  @ValidateIf((dto) => dto.scope === "owner" || dto.module !== undefined)
  @IsIn(LISTING_MODULES)
  module?: ListingModule;
  @IsOptional() @IsString() @MaxLength(80) listingId?: string;
  @IsOptional() @Transform(trimmed) @IsString() @MaxLength(120) q?: string;
}

export class ConversationMessagesDto {
  @IsOptional() @IsString() @MaxLength(90) before?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
