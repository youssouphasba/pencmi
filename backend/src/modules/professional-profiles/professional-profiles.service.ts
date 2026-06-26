import { Injectable } from '@nestjs/common';
import { AdvertiserReviewStatus, ListingStatus, ProfessionalType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { UpsertProfessionalProfileDto } from './professional-profiles.dto';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class ProfessionalProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  findMine(userId: string) {
    return this.prisma.professionalProfile.findUnique({ where: { userId } });
  }

  async findPublic(userId: string) {
    const [user, realEstateListings, hotelListings, vehicleListings, tripListings, reviewSummary] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId, deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          city: true,
          avatarUrl: true,
          role: true,
          professionalVerified: true,
          professionalProfile: true,
        },
      }),
      this.prisma.realEstateListing.findMany({
        where: { ownerUserId: userId, status: ListingStatus.active, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.hotelProperty.findMany({
        where: { ownerUserId: userId, status: ListingStatus.active, deletedAt: null },
        include: { rooms: true },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.vehicleListing.findMany({
        where: { ownerUserId: userId, status: ListingStatus.active, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.tripListing.findMany({
        where: { ownerUserId: userId, status: ListingStatus.active, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.getReviewSummary(userId),
    ]);

    return {
      user,
      counts: {
        realEstate: realEstateListings.length,
        hotels: hotelListings.length,
        vehicles: vehicleListings.length,
        trips: tripListings.length,
      },
      listings: {
        realEstate: realEstateListings,
        hotels: hotelListings,
        vehicles: vehicleListings,
        trips: tripListings,
      },
      reviewSummary,
    };
  }

  upsertMine(userId: string, dto: UpsertProfessionalProfileDto) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      create: {
        ...dto,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
        professionalType: dto.professionalType as ProfessionalType,
        userId,
      },
      update: {
        ...dto,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : null,
        professionalType: dto.professionalType as ProfessionalType,
      },
    });
  }

  async uploadLogo(userId: string, file: UploadedImage) {
    const current = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { logoUrl: true },
    });
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });
    const asset = await this.filesService.uploadPublicImage(userId, file, 'logo');
    const fallbackBusinessName =
      [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
      owner.email ||
      owner.phone ||
      userId;
    const profile = await this.prisma.professionalProfile.upsert({
      where: { userId },
      create: {
        userId,
        businessName: fallbackBusinessName,
        professionalType: ProfessionalType.other,
        logoUrl: asset.publicUrl,
      },
      update: {
        logoUrl: asset.publicUrl,
      },
    });
    await this.filesService.softDeleteByPublicUrl(userId, current?.logoUrl);
    return profile;
  }

  async removeLogo(userId: string) {
    const current = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { logoUrl: true },
    });
    if (!current) {
      return { removed: false };
    }
    await this.prisma.professionalProfile.update({
      where: { userId },
      data: { logoUrl: null },
    });
    await this.filesService.softDeleteByPublicUrl(userId, current.logoUrl);
    return { removed: true };
  }

  private async getReviewSummary(userId: string) {
    const where = { advertiserUserId: userId, status: AdvertiserReviewStatus.published };
    const [aggregate, distribution] = await Promise.all([
      this.prisma.advertiserReview.aggregate({
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.advertiserReview.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
    ]);

    return {
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : null,
      reviewCount: aggregate._count._all,
      ratingDistribution: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: distribution.find((item) => item.rating === rating)?._count.rating || 0,
      })),
    };
  }
}
