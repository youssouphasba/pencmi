import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactSource,
  ListingStatus,
  PencmiModule,
  RequestStatus,
  TargetType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  getPagination,
  PaginationDto,
} from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateVehicleRequestDto,
  UpdateVehicleRequestStatusDto,
  VehicleSearchDto,
} from './vehicles.dto';
import {
  vehicleObject,
  vehiclePublicationFromListing,
} from './vehicle-publication.service';
import { VEHICLE_DOCUMENT_LABELS } from './vehicle-publication.schema';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private publicListing(listing: any) {
    const publication = vehiclePublicationFromListing(listing);
    const raw = vehicleObject(listing.metadata);
    const contacts = vehicleObject(publication.contactPreferences);
    const photos = [
      ...new Set<string>(
        [
          ...(Array.isArray(raw.photos) ? raw.photos : []),
          raw.coverPhoto,
        ].filter(
          (value) =>
            typeof value === 'string' &&
            (/^https?:\/\//.test(value) ||
              /^\/(?!\/)[A-Za-z0-9/_-]*files\/public\/[A-Za-z0-9_-]+$/.test(
                value,
              )),
        ),
      ),
    ];
    const pricingKeys =
      listing.vehicleMode === 'sale'
        ? ['price', 'negotiable']
        : listing.vehicleMode === 'rental'
          ? [
              'pricePerDay',
              'pricePerWeek',
              'pricePerMonth',
              'deposit',
              'includedMileage',
              'rentalConditions',
            ]
          : [
              'pricePerTrip',
              'chauffeurPriceUnit',
              'coveredAreas',
              'serviceConditions',
            ];
    const pricing = Object.fromEntries(
      pricingKeys
        .filter((key) => publication.pricing[key] !== undefined)
        .map((key) => [key, publication.pricing[key]]),
    );
    const profile = listing.owner?.professionalProfile;
    const pick = <K extends string>(
      value: unknown,
      keys: K[],
    ): Partial<Record<K, unknown>> =>
      Object.fromEntries(
        keys
          .filter((key) => vehicleObject(value)[key] !== undefined)
          .map((key) => [key, vehicleObject(value)[key]]),
      ) as Partial<Record<K, unknown>>;
    return {
      id: listing.id,
      slug: listing.slug,
      status: listing.status,
      title: listing.title,
      description: listing.description,
      vehicleMode: listing.vehicleMode,
      city: listing.city,
      price: listing.price,
      currency: listing.currency,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      owner: listing.owner
        ? {
            ...listing.owner,
            professionalProfile: profile
              ? {
                  ...profile,
                  professionalPhone:
                    contacts.phoneEnabled === false
                      ? null
                      : contacts.phoneNumber || profile.professionalPhone,
                  professionalEmail:
                    contacts.emailEnabled === false
                      ? null
                      : contacts.contactEmail || profile.professionalEmail,
                  whatsappNumber:
                    contacts.whatsappEnabled === false
                      ? null
                      : contacts.whatsappNumber || profile.whatsappNumber,
                }
              : null,
          }
        : undefined,
      metadata: {
        ...pick(publication.identity, ['brand', 'model', 'version', 'year']),
        ...pick(publication.info, [
          'mileage',
          'fuel',
          'gearbox',
          'category',
          'seats',
          'color',
          'condition',
          'power',
        ]),
        ...pricing,
        region: publication.location.region,
        district: publication.location.district,
        options: Array.isArray(publication.equipment)
          ? publication.equipment.filter((value) => typeof value === 'string')
          : [],
        conditions:
          typeof publication.conditions === 'string'
            ? publication.conditions
            : '',
        documents: publication.documents.filter((label: unknown) =>
          VEHICLE_DOCUMENT_LABELS.includes(label as any),
        ),
        photos,
        coverPhoto: photos[0] || null,
        contactPreferences: {
          phoneEnabled: contacts.phoneEnabled,
          whatsappEnabled: contacts.whatsappEnabled,
          emailEnabled: contacts.emailEnabled,
          contactFormEnabled: contacts.contactFormEnabled ?? !raw.publication,
          ...(contacts.phoneEnabled
            ? { phoneNumber: contacts.phoneNumber }
            : {}),
          ...(contacts.whatsappEnabled
            ? { whatsappNumber: contacts.whatsappNumber }
            : {}),
          ...(contacts.emailEnabled
            ? { contactEmail: contacts.contactEmail }
            : {}),
        },
      },
    };
  }

  async findPublic(query: VehicleSearchDto) {
    const pagination = getPagination(query);
    const and: Prisma.VehicleListingWhereInput[] = [];
    if (query.minPrice !== undefined || query.maxPrice !== undefined)
      and.push({ price: { gte: query.minPrice, lte: query.maxPrice } });
    for (const [key, section] of [
      ['brand', 'identity'],
      ['model', 'identity'],
      ['fuel', 'info'],
      ['gearbox', 'info'],
    ] as const) {
      if (query[key])
        and.push({
          OR: [
            {
              metadata: {
                path: ['publication', section, key],
                string_contains: query[key],
                mode: 'insensitive',
              },
            },
            {
              metadata: {
                path: [key],
                string_contains: query[key],
                mode: 'insensitive',
              },
            },
          ],
        });
    }
    if (query.query)
      and.push({
        OR: [
          { title: { contains: query.query, mode: 'insensitive' } },
          { description: { contains: query.query, mode: 'insensitive' } },
          { city: { contains: query.query, mode: 'insensitive' } },
          ...['brand', 'model'].flatMap((key) => [
            {
              metadata: {
                path: ['publication', 'identity', key],
                string_contains: query.query,
                mode: 'insensitive' as const,
              },
            },
            {
              metadata: {
                path: [key],
                string_contains: query.query,
                mode: 'insensitive' as const,
              },
            },
          ]),
          {
            metadata: {
              path: ['publication', 'info', 'category'],
              string_contains: query.query,
              mode: 'insensitive',
            },
          },
          {
            metadata: {
              path: ['category'],
              string_contains: query.query,
              mode: 'insensitive',
            },
          },
        ],
      });
    const where: Prisma.VehicleListingWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      vehicleMode: query.vehicleMode || undefined,
      AND: and,
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
    return {
      data: data.map((listing) => this.publicListing(listing)),
      meta: pagination.meta(total),
    };
  }

  async findPublicOne(id: string) {
    const listing = await this.prisma.vehicleListing.findFirst({
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
    if (!listing) throw new NotFoundException('Annonce introuvable.');
    return this.publicListing(listing);
  }

  async createRentalRequest(listingId: string, dto: CreateVehicleRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.requestListing(tx, listingId, 'rental', dto);
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
        data: {
          ownerUserId: listing.ownerUserId,
          module: PencmiModule.vehicles,
          source: ContactSource.rental_request,
          targetType: TargetType.listing,
          targetId: listingId,
          metadata: { requestId: request.id },
        },
      });
      return { id: request.id, status: request.status };
    });
  }

  async createChauffeurRequest(
    listingId: string,
    dto: CreateVehicleRequestDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.requestListing(
        tx,
        listingId,
        'chauffeur',
        dto,
      );
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
        data: {
          ownerUserId: listing.ownerUserId,
          module: PencmiModule.vehicles,
          source: ContactSource.chauffeur_request,
          targetType: TargetType.listing,
          targetId: listingId,
          metadata: { requestId: request.id },
        },
      });
      return { id: request.id, status: request.status };
    });
  }

  private async requestListing(
    tx: Prisma.TransactionClient,
    id: string,
    mode: string | undefined,
    dto: CreateVehicleRequestDto,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id} FOR UPDATE`;
    const listing = await tx.vehicleListing.findFirst({
      where: { id, status: 'active', deletedAt: null },
    });
    if (!listing) throw new NotFoundException('Annonce indisponible.');
    if (mode && listing.vehicleMode !== mode)
      throw new BadRequestException(
        'Cette demande ne correspond pas au type d’annonce.',
      );
    const phone = (dto.clientPhone || '').replace(/[ ()-]/g, '');
    if (!dto.clientEmail && !/^\+?\d{7,15}$/.test(phone))
      throw new BadRequestException(
        'Renseignez un téléphone ou un email utilisable.',
      );
    if (dto.clientPhone && !/^\+?\d{7,15}$/.test(phone))
      throw new BadRequestException('Téléphone invalide.');
    if (!dto.clientName?.trim())
      throw new BadRequestException('Renseignez votre nom.');
    if (mode) {
      const start = dto.startDate ? new Date(dto.startDate) : null;
      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Africa/Dakar',
      });
      if (
        !start ||
        !Number.isFinite(start.getTime()) ||
        start.toISOString().slice(0, 10) < today
      )
        throw new BadRequestException(
          'Choisissez une date valide, non passée.',
        );
      if (mode === 'rental') {
        const end = dto.endDate ? new Date(dto.endDate) : null;
        if (!end || !Number.isFinite(end.getTime()) || end <= start)
          throw new BadRequestException(
            'La fin doit être après le début de la location.',
          );
      }
    }
    return listing;
  }

  async createContact(listingId: string, dto: CreateVehicleRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await this.requestListing(tx, listingId, undefined, dto);
      const metadata = vehicleObject(listing.metadata);
      if (
        metadata.publication &&
        !vehiclePublicationFromListing(listing).contactPreferences
          .contactFormEnabled
      )
        throw new BadRequestException(
          'Le formulaire de contact est désactivé pour cette annonce.',
        );
      const event = await tx.contactEvent.create({
        data: {
          ownerUserId: listing.ownerUserId,
          module: 'vehicles',
          source: 'form',
          targetType: 'listing',
          targetId: listingId,
          metadata: {
            clientName: dto.clientName,
            clientPhone: dto.clientPhone || '',
            clientEmail: dto.clientEmail || '',
            message: dto.message || '',
            listingTitle: listing.title,
          },
        },
      });
      return { id: event.id, received: true };
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.vehicleListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: 'desc' },
      }),
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

  updateRentalRequestStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateVehicleRequestStatusDto,
  ) {
    return this.updateRequestStatus('rental', ownerUserId, id, dto.status);
  }

  updateChauffeurRequestStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateVehicleRequestStatusDto,
  ) {
    return this.updateRequestStatus('chauffeur', ownerUserId, id, dto.status);
  }

  private async updateRequestStatus(
    mode: 'rental' | 'chauffeur',
    ownerUserId: string,
    id: string,
    status: RequestStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current =
        mode === 'rental'
          ? await tx.vehicleRentalRequest.findFirst({
              where: { id, listing: { ownerUserId, deletedAt: null } },
            })
          : await tx.vehicleChauffeurRequest.findFirst({
              where: { id, listing: { ownerUserId, deletedAt: null } },
            });
      if (!current) throw new NotFoundException('Demande introuvable.');
      await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${current.listingId} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
      const listing = await tx.vehicleListing.findFirst({
        where: { id: current.listingId, ownerUserId, deletedAt: null },
      });
      if (!listing) throw new NotFoundException('Demande introuvable.');
      const latest =
        mode === 'rental'
          ? await tx.vehicleRentalRequest.findUniqueOrThrow({ where: { id } })
          : await tx.vehicleChauffeurRequest.findUniqueOrThrow({
              where: { id },
            });
      const transitions: Partial<Record<RequestStatus, RequestStatus[]>> = {
        new: [
          'pending',
          'accepted',
          'refused',
          'cancelled',
          'requires_more_info',
        ],
        pending: ['accepted', 'refused', 'cancelled', 'requires_more_info'],
        requires_more_info: ['pending', 'accepted', 'refused', 'cancelled'],
        accepted: ['cancelled', 'completed'],
      };
      if (
        latest.status !== status &&
        !transitions[latest.status]?.includes(status)
      )
        throw new BadRequestException(
          'Cette transition de statut est impossible.',
        );
      if (
        status === 'accepted' &&
        (listing.status !== 'active' || listing.vehicleMode !== mode)
      )
        throw new BadRequestException(
          'L’annonce doit être active et correspondre à la prestation demandée.',
        );
      const include = {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            vehicleMode: true,
            status: true,
          },
        },
      };
      return mode === 'rental'
        ? tx.vehicleRentalRequest.update({
            where: { id },
            data: { status },
            include,
          })
        : tx.vehicleChauffeurRequest.update({
            where: { id },
            data: { status },
            include,
          });
    });
  }

  async softDelete(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
      const listing = await tx.vehicleListing.findFirst({
        where: { id, ownerUserId, deletedAt: null },
      });
      if (!listing) throw new NotFoundException('Annonce introuvable.');
      await tx.vehicleListing.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'deleted' },
      });
      return { id, deleted: true };
    });
  }
}
