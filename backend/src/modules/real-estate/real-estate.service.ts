import { Injectable } from '@nestjs/common';
import { ContactSource, ListingStatus, PencmiModule, TargetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateRealEstateDto, CreateVisitRequestDto, RealEstateSearchDto, UpdateRealEstateDto } from './real-estate.dto';

@Injectable()
export class RealEstateService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: RealEstateSearchDto) {
    const pagination = getPagination(query);
    const where: Prisma.RealEstateListingWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      transaction: query.transaction || undefined,
      propertyType: query.propertyType || undefined,
      ...(query.city
        ? {
            OR: [
              { city: { contains: query.city, mode: 'insensitive' } },
              { neighborhood: { contains: query.city, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.realEstateListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: true,
              professionalProfile: {
                select: {
                  businessName: true,
                  professionalType: true,
                  city: true,
                  logoUrl: true,
                  whatsappNumber: true,
                  professionalPhone: true,
                  professionalEmail: true,
                  openingHours: true,
                  verified: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.realEstateListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  findPublicOne(id: string) {
    return this.prisma.realEstateListing.findFirstOrThrow({
      where: { id, status: ListingStatus.active, deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            professionalProfile: {
              select: {
                businessName: true,
                professionalType: true,
                city: true,
                logoUrl: true,
                whatsappNumber: true,
                professionalPhone: true,
                professionalEmail: true,
                openingHours: true,
                verified: true,
                website: true,
                description: true,
              },
            },
          },
        },
      },
    });
  }

  async createVisitRequest(listingId: string, dto: CreateVisitRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.realEstateVisitRequest.create({
        data: {
          listingId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
          message: dto.message,
        },
      });
      await tx.contactEvent.create({
        data: {
          module: PencmiModule.real_estate,
          source: ContactSource.visit_request,
          targetType: TargetType.listing,
          targetId: listingId,
          metadata: { requestId: request.id },
        },
      });
      return request;
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.realEstateListing.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.realEstateListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async findMyVisitRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      listing: {
        ownerUserId,
        deletedAt: null,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.realEstateVisitRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
              neighborhood: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.realEstateVisitRequest.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  create(ownerUserId: string, dto: CreateRealEstateDto) {
    return this.prisma.realEstateListing.create({ data: { ...dto, ownerUserId } });
  }

  update(ownerUserId: string, id: string, dto: UpdateRealEstateDto) {
    return this.prisma.realEstateListing.updateMany({ where: { id, ownerUserId }, data: dto });
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.realEstateListing.updateMany({ where: { id, ownerUserId }, data: { deletedAt: new Date() } });
  }
}
