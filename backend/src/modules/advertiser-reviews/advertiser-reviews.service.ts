import { Injectable, NotFoundException } from '@nestjs/common';
import { AdvertiserReviewStatus, PencmiModule, TargetType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateAdvertiserReviewDto, UpdateAdvertiserReviewStatusDto } from './advertiser-reviews.dto';

@Injectable()
export class AdvertiserReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublicReviews(advertiserUserId: string, pagination: PaginationDto) {
    await this.ensureAdvertiserExists(advertiserUserId);
    const { skip, take, meta } = getPagination(pagination);
    const where = { advertiserUserId, status: AdvertiserReviewStatus.published };
    const [reviews, total, summary] = await Promise.all([
      this.prisma.advertiserReview.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          rating: true,
          comment: true,
          module: true,
          targetType: true,
          targetId: true,
          createdAt: true,
          publishedAt: true,
        },
      }),
      this.prisma.advertiserReview.count({ where }),
      this.getPublicSummary(advertiserUserId),
    ]);

    return { summary, reviews, meta: meta(total) };
  }

  async getPublicSummary(advertiserUserId: string) {
    const where = { advertiserUserId, status: AdvertiserReviewStatus.published };
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

  async createPublicReview(advertiserUserId: string, dto: CreateAdvertiserReviewDto) {
    await this.ensureAdvertiserExists(advertiserUserId);
    return this.prisma.advertiserReview.create({
      data: {
        advertiserUserId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        module: dto.module as PencmiModule | undefined,
        targetType: dto.targetType as TargetType | undefined,
        targetId: dto.targetId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findMine(advertiserUserId: string, pagination: PaginationDto) {
    const { skip, take, meta } = getPagination(pagination);
    const [reviews, total, summary] = await Promise.all([
      this.prisma.advertiserReview.findMany({
        where: { advertiserUserId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.advertiserReview.count({ where: { advertiserUserId } }),
      this.getPublicSummary(advertiserUserId),
    ]);

    return { summary, reviews, meta: meta(total) };
  }

  async findAllAdmin(pagination: PaginationDto) {
    const { skip, take, meta } = getPagination(pagination);
    const [reviews, total] = await Promise.all([
      this.prisma.advertiserReview.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          advertiser: {
            select: {
              id: true,
              email: true,
              phone: true,
              professionalProfile: {
                select: {
                  businessName: true,
                  professionalType: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.advertiserReview.count(),
    ]);

    return { reviews, meta: meta(total) };
  }

  async updateStatus(adminUserId: string, id: string, dto: UpdateAdvertiserReviewStatusDto) {
    const status = dto.status as AdvertiserReviewStatus;
    const review = await this.prisma.advertiserReview.update({
      where: { id },
      data: {
        status,
        moderatedAt: new Date(),
        publishedAt: status === AdvertiserReviewStatus.published ? new Date() : null,
      },
    });

    await this.audit.write({
      actorUserId: adminUserId,
      action: 'advertiser_review_status_updated',
      module: PencmiModule.users,
      targetType: TargetType.advertiser,
      targetId: review.advertiserUserId,
      metadata: { reviewId: review.id, status: review.status },
    });

    return review;
  }

  private async ensureAdvertiserExists(userId: string) {
    const advertiser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        professionalProfile: { isNot: null },
      },
      select: { id: true },
    });

    if (!advertiser) {
      throw new NotFoundException('Annonceur introuvable.');
    }
  }
}
