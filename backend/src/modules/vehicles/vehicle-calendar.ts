import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

const DAY = 86_400_000;
const MAX_RANGE_DAYS = 400;
const MAX_BLOCK_DAYS = 366;
const MAX_FUTURE_DAYS = 730;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-zA-Z0-9_-]{1,120}$/;

export class VehicleCalendarParams {
  @Matches(ID)
  id: string;
}

export class VehicleBlockParams extends VehicleCalendarParams {
  @Matches(ID)
  blockId: string;
}

export class VehicleCalendarQuery {
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;
}

/** Both dates included: the vehicle is unavailable from `startDate` to `endDate`. */
export class CreateVehicleBlockDto {
  @Matches(DATE)
  startDate: string;

  @Matches(DATE)
  endDate: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  reason?: string;
}

const day = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Date invalide.');
  return date;
};
const today = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

function range(query: VehicleCalendarQuery) {
  const from = query.from ? day(query.from) : today();
  const to = query.to ? day(query.to) : new Date(from.valueOf() + 90 * DAY);
  if (to <= from) throw new BadRequestException('La fin doit suivre le début.');
  if (to.valueOf() - from.valueOf() > MAX_RANGE_DAYS * DAY) throw new BadRequestException(`${MAX_RANGE_DAYS} jours au maximum.`);
  return { from, to };
}

/** A rental (end excluded) or a block overlaps [start, end). */
export async function vehicleUnavailable(
  tx: Prisma.TransactionClient,
  listingId: string,
  start: Date,
  end: Date,
  exceptRequestId?: string,
) {
  const [rental, block] = await Promise.all([
    tx.vehicleRentalRequest.findFirst({
      where: { listingId, status: 'accepted', startDate: { lt: end }, endDate: { gt: start }, ...(exceptRequestId ? { id: { not: exceptRequestId } } : {}) },
      select: { id: true },
    }),
    tx.vehicleAvailabilityBlock.findFirst({ where: { listingId, startDate: { lt: end }, endDate: { gt: start } }, select: { id: true } }),
  ]);
  return rental ? 'rental' : block ? 'block' : null;
}

@Injectable()
export class VehicleCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedRental(tx: Prisma.TransactionClient, ownerUserId: string, id: string, lock = false) {
    if (lock) await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
    const listing = await tx.vehicleListing.findFirst({ where: { id, ownerUserId, deletedAt: null }, select: { id: true, vehicleMode: true, title: true } });
    if (!listing) throw new NotFoundException('Véhicule introuvable.');
    if (listing.vehicleMode !== 'rental') throw new BadRequestException('Le calendrier concerne les véhicules en location.');
    return listing;
  }

  async calendar(ownerUserId: string, id: string, query: VehicleCalendarQuery) {
    const { from, to } = range(query);
    const listing = await this.ownedRental(this.prisma, ownerUserId, id);
    const [rentals, blocks] = await Promise.all([
      this.prisma.vehicleRentalRequest.findMany({
        where: { listingId: id, status: { in: ['accepted', 'completed', 'pending', 'new'] }, startDate: { lt: to }, endDate: { gt: from } },
        orderBy: { startDate: 'asc' },
        select: { id: true, status: true, startDate: true, endDate: true, clientName: true },
      }),
      this.prisma.vehicleAvailabilityBlock.findMany({
        where: { listingId: id, startDate: { lt: to }, endDate: { gt: from } },
        orderBy: { startDate: 'asc' },
        select: { id: true, startDate: true, endDate: true, reason: true },
      }),
    ]);
    return { listing, from, to, rentals, blocks };
  }

  async addBlock(ownerUserId: string, id: string, dto: CreateVehicleBlockDto) {
    const start = day(dto.startDate);
    const end = new Date(day(dto.endDate).valueOf() + DAY);
    if (end <= start) throw new BadRequestException('La date de fin doit suivre la date de début.');
    if (start < today()) throw new BadRequestException('Les dates passées ne peuvent pas être bloquées.');
    if (end.valueOf() - start.valueOf() > MAX_BLOCK_DAYS * DAY) throw new BadRequestException(`Une indisponibilité dure ${MAX_BLOCK_DAYS} jours au plus.`);
    if (end.valueOf() - today().valueOf() > MAX_FUTURE_DAYS * DAY) throw new BadRequestException('Date trop lointaine.');
    return this.prisma.$transaction(async (tx) => {
      // Same lock as rental acceptance: a block and an acceptance cannot cross.
      await this.ownedRental(tx, ownerUserId, id, true);
      const clash = await vehicleUnavailable(tx, id, start, end);
      if (clash === 'rental') throw new ConflictException('Une location acceptée occupe déjà ces dates.');
      if (clash === 'block') throw new ConflictException('Ces dates chevauchent une indisponibilité existante.');
      return tx.vehicleAvailabilityBlock.create({
        data: { listingId: id, startDate: start, endDate: end, reason: dto.reason || null, createdByUserId: ownerUserId },
        select: { id: true, startDate: true, endDate: true, reason: true },
      });
    });
  }

  async removeBlock(ownerUserId: string, id: string, blockId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.ownedRental(tx, ownerUserId, id, true);
      const removed = await tx.vehicleAvailabilityBlock.deleteMany({ where: { id: blockId, listingId: id } });
      if (!removed.count) throw new NotFoundException('Indisponibilité introuvable.');
      return { id: blockId, deleted: true };
    });
  }

  /** Busy periods of an active rental vehicle, merged, without any client detail. */
  async publicAvailability(id: string, query: VehicleCalendarQuery) {
    const { from, to } = range(query);
    const listing = await this.prisma.vehicleListing.findFirst({ where: { id, status: 'active', deletedAt: null, vehicleMode: 'rental' }, select: { id: true } });
    if (!listing) throw new NotFoundException('Véhicule introuvable.');
    const [rentals, blocks] = await Promise.all([
      this.prisma.vehicleRentalRequest.findMany({ where: { listingId: id, status: 'accepted', startDate: { lt: to }, endDate: { gt: from } }, select: { startDate: true, endDate: true } }),
      this.prisma.vehicleAvailabilityBlock.findMany({ where: { listingId: id, startDate: { lt: to }, endDate: { gt: from } }, select: { startDate: true, endDate: true } }),
    ]);
    const periods = [...rentals, ...blocks]
      .filter((period): period is { startDate: Date; endDate: Date } => Boolean(period.startDate && period.endDate))
      .sort((a, b) => a.startDate.valueOf() - b.startDate.valueOf());
    const busy: { start: string; end: string }[] = [];
    let current: { start: Date; end: Date } | null = null;
    for (const period of periods) {
      if (current && period.startDate <= current.end) current.end = period.endDate > current.end ? period.endDate : current.end;
      else {
        if (current) busy.push({ start: current.start.toISOString().slice(0, 10), end: current.end.toISOString().slice(0, 10) });
        current = { start: period.startDate, end: period.endDate };
      }
    }
    if (current) busy.push({ start: current.start.toISOString().slice(0, 10), end: current.end.toISOString().slice(0, 10) });
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), busy };
  }
}

@ApiTags('vehicles')
@Controller()
export class VehicleCalendarController {
  constructor(private readonly service: VehicleCalendarService) {}

  /** `end` is the first free day. */
  @Public()
  @Get('voitures/:id/availability')
  availability(@Param() params: VehicleCalendarParams, @Query() query: VehicleCalendarQuery) {
    return this.service.publicAvailability(params.id, query);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Get('dashboard/voitures/:id/calendar')
  calendar(@CurrentUser() user: AuthenticatedUser, @Param() params: VehicleCalendarParams, @Query() query: VehicleCalendarQuery) {
    return this.service.calendar(user.id, params.id, query);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Post('dashboard/voitures/:id/blocks')
  addBlock(@CurrentUser() user: AuthenticatedUser, @Param() params: VehicleCalendarParams, @Body() dto: CreateVehicleBlockDto) {
    return this.service.addBlock(user.id, params.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_vehicles')
  @Delete('dashboard/voitures/:id/blocks/:blockId')
  removeBlock(@CurrentUser() user: AuthenticatedUser, @Param() params: VehicleBlockParams) {
    return this.service.removeBlock(user.id, params.id, params.blockId);
  }
}
