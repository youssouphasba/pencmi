import { Type, Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { TRIP_TYPES, TRIP_PHONE_PATTERN } from "./trip-publication.schema";
import { PaginationDto } from "../../common/pagination/pagination.dto";

export class TripSearchDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) occurrenceId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(150)
  departureCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  arrivalCity?: string;

  @IsOptional() @IsString() @MaxLength(200) query?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsIn(TRIP_TYPES) vehicleType?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  passengers?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  maxPrice?: number;
  @IsOptional()
  @IsIn(["morning", "afternoon", "evening", "night"])
  timeOfDay?: string;
}

export class CreateTripDto {
  @IsUUID() requestId: string;
  @IsOptional() @IsObject() publication?: Record<string, unknown>;
}
export class UpdateTripDto {
  @IsObject() publication: Record<string, unknown>;
}

export class CreateSeatRequestDto {
  @IsString() @MaxLength(100) occurrenceId: string;
  @IsUUID() requestId: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  clientName: string;

  @IsOptional()
  @Matches(TRIP_PHONE_PATTERN)
  clientPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  clientEmail?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  requestedSeats: number;

  @IsOptional()
  @IsBoolean()
  luggage?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  message?: string;
}

const seatRequestStatuses = [
  "accepted",
  "completed",
  "pending",
  "refused",
  "cancelled",
  "requires_more_info",
] as const;

export class UpdateSeatRequestStatusDto {
  @IsIn(seatRequestStatuses)
  status: (typeof seatRequestStatuses)[number];
}
export class ModerateTripDto {
  @IsIn(["active", "refused", "suspended"]) status:
    | "active"
    | "refused"
    | "suspended";
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  @IsOptional() @IsISO8601({ strict: true }) @MaxLength(35) expectedUpdatedAt?: string;
}
export class CancelTripOccurrenceDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}
