import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { randomInt } from 'crypto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

/** No 0/O or 1/I: a code read aloud or typed from a phone is not misread. */
const TICKET_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const TICKET_LENGTH = 10;
const HOUR = 3_600_000;
/** Boarding opens the day before departure and closes half a day after it. */
const BOARDING_OPENS_MS = 24 * HOUR;
const BOARDING_CLOSES_MS = 12 * HOUR;
const ID = /^[a-zA-Z0-9_-]{1,120}$/;

export function newTicketCode() {
  return Array.from({ length: TICKET_LENGTH }, () => TICKET_ALPHABET[randomInt(TICKET_ALPHABET.length)]).join('');
}

/** Spaces, dashes and case are ignored, as when the code is read from a screen. */
export const normalizeTicketCode = (value: unknown) => (typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value);

export class TripOccurrenceParams {
  @Matches(ID)
  id: string;

  @Matches(ID)
  occurrenceId: string;
}

export class TripBoardingDto {
  @IsOptional()
  @Transform(({ value }) => normalizeTicketCode(value))
  @Matches(new RegExp(`^[${TICKET_ALPHABET}]{${TICKET_LENGTH}}$`), { message: 'Code de billet invalide.' })
  ticketCode?: string;

  @IsOptional()
  @Matches(ID)
  requestId?: string;

  @IsIn(['boarded', 'no_show', 'pending'])
  status: 'boarded' | 'no_show' | 'pending';
}

const passengerSelect = {
  id: true,
  clientName: true,
  clientPhone: true,
  allocatedSeats: true,
  luggage: true,
  status: true,
  ticketCode: true,
  boardingStatus: true,
  boardedAt: true,
} as const;

@Injectable()
export class TripBoardingService {
  constructor(private readonly prisma: PrismaService) {}

  private async occurrence(ownerUserId: string, tripId: string, occurrenceId: string) {
    const occurrence = await this.prisma.tripOccurrence.findFirst({
      where: { id: occurrenceId, tripId, trip: { ownerUserId, deletedAt: null } },
      include: { trip: { select: { id: true, title: true, departureCity: true, arrivalCity: true } } },
    });
    if (!occurrence) throw new NotFoundException('Départ introuvable.');
    return occurrence;
  }

  async manifest(ownerUserId: string, tripId: string, occurrenceId: string) {
    const occurrence = await this.occurrence(ownerUserId, tripId, occurrenceId);
    const passengers = await this.prisma.tripSeatRequest.findMany({
      where: { occurrenceId, status: { in: ['accepted', 'completed'] } },
      orderBy: [{ clientName: 'asc' }, { id: 'asc' }],
      select: passengerSelect,
    });
    const seats = (rows: typeof passengers) => rows.reduce((sum, row) => sum + (row.allocatedSeats ?? 0), 0);
    const now = Date.now();
    return {
      occurrence: {
        id: occurrence.id,
        departureAt: occurrence.departureAt,
        cancelledAt: occurrence.cancelledAt,
        confirmedSeats: occurrence.confirmedSeats,
        trip: occurrence.trip,
        boardingOpen: this.boardingOpen(occurrence, now),
      },
      totals: {
        passengers: passengers.length,
        seats: seats(passengers),
        boardedSeats: seats(passengers.filter((row) => row.boardingStatus === 'boarded')),
        noShowSeats: seats(passengers.filter((row) => row.boardingStatus === 'no_show')),
      },
      passengers,
    };
  }

  private boardingOpen(occurrence: { departureAt: Date; cancelledAt: Date | null }, now = Date.now()) {
    const departure = occurrence.departureAt.valueOf();
    return !occurrence.cancelledAt && now >= departure - BOARDING_OPENS_MS && now <= departure + BOARDING_CLOSES_MS;
  }

  async board(ownerUserId: string, tripId: string, occurrenceId: string, dto: TripBoardingDto) {
    if (!dto.ticketCode === !dto.requestId) throw new BadRequestException('Indiquez un code de billet ou un passager.');
    const occurrence = await this.occurrence(ownerUserId, tripId, occurrenceId);
    if (occurrence.cancelledAt) throw new ConflictException('Ce départ est annulé.');
    if (!this.boardingOpen(occurrence))
      throw new ConflictException('L’embarquement ouvre 24 h avant le départ et ferme 12 h après.');
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.tripSeatRequest.findFirst({
        where: dto.ticketCode ? { ticketCode: dto.ticketCode } : { id: dto.requestId },
        select: { ...passengerSelect, occurrenceId: true },
      });
      if (!request || request.occurrenceId !== occurrenceId) throw new NotFoundException('Billet inconnu pour ce départ.');
      if (!['accepted', 'completed'].includes(request.status)) throw new ConflictException('Ce billet a été annulé.');
      if (dto.status === 'boarded' && request.boardingStatus === 'boarded' && dto.ticketCode)
        throw new ConflictException('Ce billet a déjà été utilisé pour embarquer.');
      const boardingStatus = dto.status === 'pending' ? null : dto.status;
      const updated = await tx.tripSeatRequest.update({
        where: { id: request.id },
        data: { boardingStatus, boardedAt: dto.status === 'boarded' ? new Date() : null },
        select: passengerSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: ownerUserId,
          module: 'trips',
          targetType: 'listing',
          targetId: tripId,
          action: `trip.boarding.${dto.status}`,
          metadata: { occurrenceId, requestId: request.id, byCode: Boolean(dto.ticketCode) },
        },
      });
      return updated;
    });
  }
}

@ApiTags('trips')
@ApiBearerAuth()
@RequirePermissions('manage_trips')
@Controller('dashboard/voyages/:id/occurrences/:occurrenceId')
export class TripBoardingController {
  constructor(private readonly service: TripBoardingService) {}

  @Get('manifest')
  manifest(@CurrentUser() user: AuthenticatedUser, @Param() params: TripOccurrenceParams) {
    return this.service.manifest(user.id, params.id, params.occurrenceId);
  }

  @Post('boarding')
  board(@CurrentUser() user: AuthenticatedUser, @Param() params: TripOccurrenceParams, @Body() dto: TripBoardingDto) {
    return this.service.board(user.id, params.id, params.occurrenceId, dto);
  }
}
