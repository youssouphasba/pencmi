import { Injectable } from '@nestjs/common';
import { AccountStatus, ListingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, advertisers, reports, hotels, realEstate, vehicles, trips, activeRealEstate, pendingRealEstate] = await Promise.all([
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
      this.prisma.hotelProperty.count(),
      this.prisma.realEstateListing.count(),
      this.prisma.vehicleListing.count(),
      this.prisma.tripListing.count(),
      this.prisma.realEstateListing.count({ where: { status: ListingStatus.active, deletedAt: null } }),
      this.prisma.realEstateListing.count({ where: { status: ListingStatus.pending_review, deletedAt: null } }),
    ]);
    return { users, advertisers, reports, hotels, realEstate, vehicles, trips, activeRealEstate, pendingRealEstate };
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

  realEstateListings() {
    return this.prisma.realEstateListing.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            role: true,
            status: true,
            professionalProfile: {
              select: {
                businessName: true,
                professionalType: true,
                city: true,
                verified: true,
              },
            },
          },
        },
        visitRequests: {
          select: {
            id: true,
          },
        },
      },
    });
  }
}
