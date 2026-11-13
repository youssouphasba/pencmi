import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CONTENT_PAGE_SLUGS, ContentPageSlug, FAQ_CATEGORIES, MAX_CONTENT_SECTIONS, MAX_SECTION_BODY } from './content.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ContentSlugParams {
  @IsIn(CONTENT_PAGE_SLUGS)
  slug: ContentPageSlug;
}

export class ContentVersionParams extends ContentSlugParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  versionId: string;
}

export class ContentIdParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}

export class ContentSectionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  heading: string;

  /** Plain text. Paragraphs are separated by a blank line, list items start with "- ". */
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_SECTION_BODY)
  body: string;
}

export class SaveContentPageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(400)
  subtitle?: string;

  @IsIn(['draft', 'active'])
  status: 'draft' | 'active';

  @IsArray()
  @ArrayMaxSize(MAX_CONTENT_SECTIONS)
  @ValidateNested({ each: true })
  @Type(() => ContentSectionDto)
  sections: ContentSectionDto[];
}

export class SaveFaqItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  answer: string;

  @IsOptional()
  @IsIn(FAQ_CATEGORIES)
  category?: (typeof FAQ_CATEGORIES)[number];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  position?: number;
}
