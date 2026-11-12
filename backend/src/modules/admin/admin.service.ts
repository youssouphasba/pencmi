import { Injectable } from '@nestjs/common';
import { ListingStatus, UserRole } from '@prisma/client';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const where = { deletedAt: null, status: { not: ListingStatus.deleted } };
    const [users, advertisers, reports, realEstateStatuses, hotelStatuses, vehicleStatuses, tripStatuses,
      messages, contacts, notifications, failedEmails] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: { in: [
        UserRole.advertiser_individual,
        UserRole.real_estate_agency,
        UserRole.hotel_manager,
        UserRole.vehicle_renter,
        UserRole.vehicle_dealer,
        UserRole.chauffeur,
        UserRole.transport_provider,
      ] }, deletedAt: null } }),
      this.prisma.report.count(),
      this.prisma.realEstateListing.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.hotelProperty.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.vehicleListing.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.tripListing.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.message.count({ where: { hiddenAt: null } }),
      this.prisma.contactEvent.count(),
      this.prisma.notification.count(),
      this.prisma.emailLog.count({ where: { status: 'failed' } }),
    ]);
    const counts = (rows: typeof realEstateStatuses) => ({
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
      active: rows.find((row) => row.status === 'active')?._count._all ?? 0,
      pending: rows.find((row) => row.status === 'pending_review')?._count._all ?? 0,
    });
    const listingCounts = { real_estate: counts(realEstateStatuses), hotels: counts(hotelStatuses), vehicles: counts(vehicleStatuses), trips: counts(tripStatuses) };
    return { users, advertisers, reports, listingCounts, messages, contacts, notifications, failedEmails,
      realEstate: listingCounts.real_estate.total, hotels: listingCounts.hotels.total,
      vehicles: listingCounts.vehicles.total, trips: listingCounts.trips.total,
      activeRealEstate: listingCounts.real_estate.active, pendingRealEstate: listingCounts.real_estate.pending };
  }

  async contacts(query: PaginationDto) {
    const page = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contactEvent.findMany({ skip: page.skip, take: page.take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, module: true, source: true, targetId: true, ownerUserId: true, createdAt: true } }),
      this.prisma.contactEvent.count(),
    ]);
    return { data, meta: page.meta(total) };
  }

  async notifications(query: PaginationDto) {
    const page = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ skip: page.skip, take: page.take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, module: true, type: true, status: true, priority: true, createdAt: true } }),
      this.prisma.notification.count(),
    ]);
    return { data, meta: page.meta(total) };
  }

  async emailActivity(query: PaginationDto) {
    const page = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({ skip: page.skip, take: page.take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { id: true, toEmail: true, templateKey: true, subject: true, status: true, createdAt: true, sentAt: true } }),
      this.prisma.emailLog.count(),
    ]);
    return { data, meta: page.meta(total) };
  }

  users() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        professionalVerified: true,
        createdAt: true,
      },
    });
  }

  async advertisers() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: {
          in: [
            UserRole.advertiser_individual,
            UserRole.real_estate_agency,
            UserRole.hotel_manager,
            UserRole.vehicle_renter,
            UserRole.vehicle_dealer,
            UserRole.chauffeur,
            UserRole.transport_provider,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        role: true,
        status: true,
        createdAt: true,
        professionalVerified: true,
        professionalProfile: {
          select: {
            businessName: true,
            professionalType: true,
            city: true,
            verified: true,
          },
        },
      },
    });

    // Listings of the four universes: a hotel or a carrier has no real-estate listing.
    const args = { by: ['ownerUserId' as const], where: { deletedAt: null }, _count: { _all: true as const } };
    const groups = await Promise.all([
      this.prisma.realEstateListing.groupBy(args),
      this.prisma.hotelProperty.groupBy(args),
      this.prisma.vehicleListing.groupBy(args),
      this.prisma.tripListing.groupBy(args),
    ]);
    const countMap = new Map<string, number>();
    for (const entry of groups.flat())
      countMap.set(entry.ownerUserId, (countMap.get(entry.ownerUserId) ?? 0) + entry._count._all);

    return users.map((user) => ({
      ...user,
      listingsCount: countMap.get(user.id) ?? 0,
    }));
  }

}
