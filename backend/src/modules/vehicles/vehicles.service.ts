import { Injectable } from '@nestjs/common';
import { ContactSource, ListingStatus, PencmiModule, RequestStatus, TargetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateVehicleDto, CreateVehicleRequestDto, UpdateVehicleDto, UpdateVehicleRequestStatusDto, VehicleSearchDto } from './vehicles.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: VehicleSearchDto) {
    const pagination = getPagination(query);
    const where: Prisma.VehicleListingWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      vehicleMode: query.vehicleMode || undefined,
      ...(query.city
        ? {
            OR: [
              { city: { contains: query.city, mode: 'insensitive' } },
              { title: { contains: query.city, mode: 'insensitive' } },
              { description: { contains: query.city, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vehicleListing.findMany({
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
              role: true,
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
      }),
      this.prisma.vehicleListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  findPublicOne(id: string) {
    return this.prisma.vehicleListing.findFirstOrThrow({
      where: { id, status: ListingStatus.active, deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            role: true,
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

  async createRentalRequest(listingId: string, dto: CreateVehicleRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.vehicleRentalRequest.create({
        data: {
          listingId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          message: dto.message,
        },
      });
      await tx.contactEvent.create({
        data: { module: PencmiModule.vehicles, source: ContactSource.rental_request, targetType: TargetType.listing, targetId: listingId, metadata: { requestId: request.id } },
      });
      return request;
    });
  }

  async createChauffeurRequest(listingId: string, dto: CreateVehicleRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.vehicleChauffeurRequest.create({
        data: {
          listingId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          serviceDate: dto.startDate ? new Date(dto.startDate) : undefined,
          message: dto.message,
        },
      });
      await tx.contactEvent.create({
        data: { module: PencmiModule.vehicles, source: ContactSource.chauffeur_request, targetType: TargetType.listing, targetId: listingId, metadata: { requestId: request.id } },
      });
      return request;
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.vehicleListing.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.vehicleListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async findMyRentalRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      listing: {
        ownerUserId,
        deletedAt: null,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.vehicleRentalRequest.findMany({
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
              vehicleMode: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.vehicleRentalRequest.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async findMyChauffeurRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      listing: {
        ownerUserId,
        deletedAt: null,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.vehicleChauffeurRequest.findMany({
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
              vehicleMode: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.vehicleChauffeurRequest.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async updateRentalRequestStatus(ownerUserId: string, id: string, dto: UpdateVehicleRequestStatusDto) {
    const request = await this.prisma.vehicleRentalRequest.findFirstOrThrow({
      where: {
        id,
        listing: {
          ownerUserId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    return this.prisma.vehicleRentalRequest.update({
      where: { id: request.id },
      data: { status: dto.status as RequestStatus },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            vehicleMode: true,
            status: true,
          },
        },
      },
    });
  }

  async updateChauffeurRequestStatus(ownerUserId: string, id: string, dto: UpdateVehicleRequestStatusDto) {
    const request = await this.prisma.vehicleChauffeurRequest.findFirstOrThrow({
      where: {
        id,
        listing: {
          ownerUserId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    return this.prisma.vehicleChauffeurRequest.update({
      where: { id: request.id },
      data: { status: dto.status as RequestStatus },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            vehicleMode: true,
            status: true,
          },
        },
      },
    });
  }

  create(ownerUserId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicleListing.create({ data: { ...dto, ownerUserId } });
  }

  update(ownerUserId: string, id: string, dto: UpdateVehicleDto) {
    return this.prisma.vehicleListing.updateMany({ where: { id, ownerUserId }, data: dto });
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.vehicleListing.updateMany({ where: { id, ownerUserId }, data: { deletedAt: new Date() } });
  }
}
