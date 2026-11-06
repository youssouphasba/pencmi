import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LISTING_MODULES, ListingModule } from '../conversations/conversation-listings';

export const STAT_PERIODS = ['today', '7', '30', '90'] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];

export class StatisticsLegacyDto {
  @IsOptional() @IsIn(LISTING_MODULES) module?: ListingModule;
}

export class StatisticsReportDto {
  @IsIn(LISTING_MODULES) module: ListingModule;
  @IsOptional() @IsIn(STAT_PERIODS) period: StatPeriod = '30';
  @IsOptional() @IsString() @MaxLength(80) listingId?: string;
}
