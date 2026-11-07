import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  AdminListingDecisionDto,
  AdminListingId,
  AdminListingParams,
  AdminListingPhotoParams,
  AdminListingsQuery,
} from "./admin-listings.dto";
import { AdminListingsService } from "./admin-listings.service";

@ApiTags("admin")
@ApiBearerAuth()
@RequirePermissions("access_admin")
@Controller("admin")
export class AdminListingsController {
  constructor(private readonly service: AdminListingsService) {}

  @Get("validation")
  list(@Query() query: AdminListingsQuery) {
    return this.service.list(query);
  }

  @Get("listings/real-estate")
  realEstate(@Query() query: AdminListingsQuery) {
    return this.service.list(query, "real_estate");
  }

  @Get("listings/hotels")
  hotels(@Query() query: AdminListingsQuery) {
    return this.service.list(query, "hotels");
  }

  @Get("listings/vehicles")
  vehicles(@Query() query: AdminListingsQuery) {
    return this.service.list(query, "vehicles");
  }

  @Get("validation/:module/:id")
  detail(@Param() params: AdminListingParams) {
    return this.service.detail(params.module, params.id);
  }

  @Get("validation/:module/:id/photos/:photoId")
  async photo(
    @Param() params: AdminListingPhotoParams,
    @Res() response: Response,
  ) {
    const { asset, buffer } = await this.service.photo(
      params.module,
      params.id,
      params.photoId,
    );
    response.setHeader("Content-Type", asset.mimeType);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(buffer);
  }

  @Patch("listings/real-estate/:id/status")
  moderateRealEstate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: AdminListingId,
    @Body() dto: AdminListingDecisionDto,
  ) {
    return this.service.moderate("real_estate", user.id, params.id, dto);
  }

  @Patch("listings/hotels/:id/status")
  moderateHotel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: AdminListingId,
    @Body() dto: AdminListingDecisionDto,
  ) {
    return this.service.moderate("hotels", user.id, params.id, dto);
  }

  @Patch("listings/vehicles/:id/status")
  moderateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: AdminListingId,
    @Body() dto: AdminListingDecisionDto,
  ) {
    return this.service.moderate("vehicles", user.id, params.id, dto);
  }
}
