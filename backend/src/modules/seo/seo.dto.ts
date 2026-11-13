import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** A public path of the site: "/", "/hotels", "/immobilier/vente"... never a private area. */
export const SEO_PATH = /^\/(?!admin(\/|$)|dashboard(\/|$)|compte(\/|$)|api(\/|$))[a-z0-9\-/]{0,200}$/;

export class SeoPathQuery {
  @IsOptional()
  @Matches(SEO_PATH)
  path?: string;
}

export class SeoIdParams {
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/)
  id: string;
}

export class SaveSeoMetaDto {
  @Transform(trim)
  @Matches(SEO_PATH, { message: 'Chemin public invalide.' })
  path: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(70)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(50)
  @MaxLength(170)
  description: string;

  @IsOptional()
  @IsBoolean()
  noindex?: boolean;
}
