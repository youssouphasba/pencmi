import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { Public, OptionalAuthentication } from "../../common/decorators/public.decorator";
import { PaginationDto } from "../../common/pagination/pagination.dto";
import { AuthenticatedUser } from "../../auth/types/authenticated-user.type";
import {
  CreateSeatRequestDto,
  CancelTripOccurrenceDto,
  CreateTripDto,
  ModerateTripDto,
  TripSearchDto,
  UpdateSeatRequestStatusDto,
  UpdateTripDto,
} from "./trips.dto";
import { TripsService } from "./trips.service";
import { TripPublicationService } from "./trip-publication.service";
import { Throttle } from "@nestjs/throttler";
import { TripOccurrencesService } from "./trip-occurrences.service";

@ApiTags("trips")
@Controller()
export class TripsController {
  constructor(
    private readonly service: TripsService,
    private readonly publication: TripPublicationService,
    private readonly occurrences: TripOccurrencesService,
  ) {}

  @ApiBearerAuth()
  @RequirePermissions("access_admin")
  @Get("admin/listings/trips")
  moderationList(@Query() query: PaginationDto) {
    return this.publication.findForModeration(query);
  }

  @ApiBearerAuth()
  @RequirePermissions("access_admin")
  @Patch("admin/listings/trips/:id/status")
  moderate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ModerateTripDto,
  ) {
    return this.publication.moderate(user.id, id, dto);
  }

  @Public()
  @Get("voyages")
  findPublic(@Query() query: TripSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get("voyages/:id")
  findPublicOne(@Param("id") id: string, @Query() query: TripSearchDto) {
    return this.service.findPublicOne(id, query.occurrenceId);
  }

  @Public()
  @Post("voyages/:id/seat-requests")
  @OptionalAuthentication()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  createSeatRequest(
    @Param("id") id: string,
    @Body() dto: CreateSeatRequestDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.createSeatRequest(id, dto, user?.id);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Post("dashboard/voyages/:id/occurrences/:occurrenceId/cancel")
  cancelOccurrence(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("occurrenceId") occurrenceId: string,
    @Body() dto: CancelTripOccurrenceDto,
  ) {
    return this.occurrences.cancel(user.id, id, occurrenceId, dto.reason);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages")
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages/seat-requests")
  findMySeatRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ) {
    return this.service.findMySeatRequests(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages/contacts")
  contacts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.service.contacts(user.id, query);
  }
  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages/conversations")
  conversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
  ) {
    return this.service.conversations(user.id, query);
  }
  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages/statistics")
  statistics(@CurrentUser() user: AuthenticatedUser) {
    return this.service.statistics(user.id);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Patch("dashboard/voyages/seat-requests/:id/status")
  updateSeatRequestStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateSeatRequestStatusDto,
  ) {
    return this.service.updateSeatRequestStatus(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions("publish_trip")
  @Post("dashboard/voyages")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTripDto) {
    return this.publication.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Get("dashboard/voyages/:id")
  findOwned(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.publication.findOwned(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips", "publish_trip")
  @Post("dashboard/voyages/:id/submit")
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.publication.submit(user.id, id);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Patch("dashboard/voyages/:id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.publication.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions("manage_trips")
  @Delete("dashboard/voyages/:id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.publication.softDelete(user.id, id);
  }
}
