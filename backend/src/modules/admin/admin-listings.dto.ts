import { Transform } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
} from "class-validator";
import { PaginationDto } from "../../common/pagination/pagination.dto";
import {
  MODERATION_DECISIONS,
  MODERATION_MODULES,
  MODERATION_STATUSES,
  ModerationModule,
} from "../../common/utils/listing-moderation";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const idFormat = /^[a-zA-Z0-9_-]{1,120}$/;

export class AdminListingsQuery extends PaginationDto {
  @Max(1_000_000)
  declare page: number;

  @IsOptional() @IsIn(MODERATION_MODULES) module?: ModerationModule;
  @IsOptional()
  @IsIn(MODERATION_STATUSES)
  status?: (typeof MODERATION_STATUSES)[number];
  @IsOptional() @IsString() @Transform(trim) @MaxLength(120) search?: string;
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(120)
  advertiser?: string;
  @IsOptional() @Matches(idFormat) ownerId?: string;
}

export class AdminListingId {
  @Matches(idFormat) id!: string;
}

export class AdminListingParams extends AdminListingId {
  @IsIn(MODERATION_MODULES) module!: ModerationModule;
}

export class AdminListingPhotoParams extends AdminListingParams {
  @Matches(idFormat) photoId!: string;
}

export class AdminListingDecisionDto {
  @IsIn(MODERATION_DECISIONS) status!: (typeof MODERATION_DECISIONS)[number];
  @IsOptional() @IsString() @Transform(trim) @MaxLength(2000) reason?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @MaxLength(35)
  expectedUpdatedAt?: string;
}
