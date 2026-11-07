import { Injectable } from '@nestjs/common';
import { AccountStatus, ListingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const where = { deletedAt: null, status: { not: ListingStatus.deleted } };
    const [users, advertisers, reports, realEstateStatuses, hotelStatuses, vehicleStatuses, tripStatuses] = await Promise.all([
      this.prisma.user.count(),
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
    ]);
    const counts = (rows: typeof realEstateStatuses) => ({
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
      active: rows.find((row) => row.status === 'active')?._count._all ?? 0,
      pending: rows.find((row) => row.status === 'pending_review')?._count._all ?? 0,
    });
    const listingCounts = { real_estate: counts(realEstateStatuses), hotels: counts(hotelStatuses), vehicles: counts(vehicleStatuses), trips: counts(tripStatuses) };
    return { users, advertisers, reports, listingCounts,
      realEstate: listingCounts.real_estate.total, hotels: listingCounts.hotels.total,
      vehicles: listingCounts.vehicles.total, trips: listingCounts.trips.total,
      activeRealEstate: listingCounts.real_estate.active, pendingRealEstate: listingCounts.real_estate.pending };
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

    const listingCounts = await this.prisma.realEstateListing.groupBy({
      by: ['ownerUserId'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    const countMap = new Map(listingCounts.map((entry) => [entry.ownerUserId, entry._count._all]));

    return users.map((user) => ({
      ...user,
      listingsCount: countMap.get(user.id) ?? 0,
    }));
  }

}
