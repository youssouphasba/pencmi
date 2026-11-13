import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { Prisma } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

export const STATISTICS_PERIODS = [7, 30, 90] as const;
const PROFESSIONAL_ROLES = ['advertiser_individual', 'real_estate_agency', 'hotel_manager', 'vehicle_renter', 'vehicle_dealer', 'chauffeur', 'transport_provider'] as const;
const REQUEST_STATUSES = ['new', 'pending', 'accepted', 'refused', 'cancelled', 'expired', 'completed', 'requires_more_info'] as const;

export class AdminStatisticsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsIn(STATISTICS_PERIODS)
  days?: (typeof STATISTICS_PERIODS)[number];
}

type GroupRow = { status: string; _count: { _all: number } };
const byStatus = (rows: GroupRow[]) => {
  const counts = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  for (const row of rows) counts[row.status] = row._count._all;
  const total = rows.reduce((sum, row) => sum + row._count._all, 0);
  const decided = counts.accepted + counts.completed + counts.refused;
  return {
    total,
    waiting: counts.new + counts.pending + counts.requires_more_info,
    accepted: counts.accepted + counts.completed,
    refused: counts.refused,
    cancelled: counts.cancelled + counts.expired,
    acceptanceRate: decided ? Math.round(((counts.accepted + counts.completed) / decided) * 100) : null,
  };
};

/** Platform-wide figures over a period, in UTC days (Dakar time is UTC). */
@Injectable()
export class AdminStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async statistics(days: number = 30, now = new Date()) {
    const since = new Date(now.valueOf() - days * 86400000);
    const created = { createdAt: { gte: since } };
    const listing = { ...created, deletedAt: null };
    const [
      clients, professionals, signupRows,
      realEstate, hotels, vehicles, trips,
      visit, hotel, rental, chauffeur, seat,
      contacts, reportsOpened, reportsClosed, messages, tracking, verifications,
    ] = await Promise.all([
      this.prisma.user.count({ where: { ...created, role: 'client' } }),
      this.prisma.user.count({ where: { ...created, role: { in: [...PROFESSIONAL_ROLES] } } }),
      this.prisma.$queryRaw<{ day: Date; count: number }[]>(Prisma.sql`
        SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS count
        FROM "User" WHERE "createdAt" >= ${since} AND "role" <> 'admin'
        GROUP BY 1 ORDER BY 1`),
      this.prisma.realEstateListing.count({ where: listing }),
      this.prisma.hotelProperty.count({ where: listing }),
      this.prisma.vehicleListing.count({ where: listing }),
      this.prisma.tripListing.count({ where: listing }),
      this.prisma.realEstateVisitRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
      this.prisma.hotelReservationRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
      this.prisma.vehicleRentalRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
      this.prisma.vehicleChauffeurRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
      this.prisma.tripSeatRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
      this.prisma.contactEvent.groupBy({ by: ['module'], where: created, _count: { _all: true } }),
      this.prisma.report.count({ where: created }),
      this.prisma.report.count({ where: { updatedAt: { gte: since }, status: { in: ['resolved', 'rejected', 'archived'] } } }),
      this.prisma.message.count({ where: created }),
      this.prisma.trackingEvent.groupBy({ by: ['module', 'eventType'], where: created, _count: { _all: true }, orderBy: { _count: { eventType: 'desc' } }, take: 12 }),
      this.prisma.verificationRequest.groupBy({ by: ['status'], where: created, _count: { _all: true } }),
    ]);
    const signups = new Map(signupRows.map((row) => [row.day.toISOString().slice(0, 10), row.count]));
    const series = Array.from({ length: days }, (_, index) => {
      const day = new Date(now.valueOf() - (days - 1 - index) * 86400000).toISOString().slice(0, 10);
      return { day, signups: signups.get(day) ?? 0 };
    });
    return {
      days,
      since,
      signups: { clients, professionals, total: clients + professionals, series },
      newListings: { real_estate: realEstate, hotels, vehicles, trips, total: realEstate + hotels + vehicles + trips },
      requests: {
        visit: byStatus(visit as GroupRow[]),
        hotel: byStatus(hotel as GroupRow[]),
        rental: byStatus(rental as GroupRow[]),
        chauffeur: byStatus(chauffeur as GroupRow[]),
        trip: byStatus(seat as GroupRow[]),
      },
      contacts: Object.fromEntries(contacts.map((row) => [row.module, row._count._all])),
      reports: { opened: reportsOpened, closed: reportsClosed },
      messages,
      verifications: Object.fromEntries(verifications.map((row) => [row.status, row._count._all])),
      topEvents: tracking.map((row) => ({ module: row.module, eventType: row.eventType, count: row._count._all })),
    };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin/statistics')
export class AdminStatisticsController {
  constructor(private readonly service: AdminStatisticsService) {}

  @Get()
  statistics(@Query() query: AdminStatisticsQuery) {
    return this.service.statistics(query.days ?? 30);
  }
}
