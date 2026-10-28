import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  ContactSource,
  FileAsset,
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
  CreateRealEstateDto,
  CreateVisitRequestDto,
  RealEstateSearchDto,
  UpdateRealEstateDto,
  UpdateVisitRequestStatusDto,
} from './real-estate.dto';
import { FilesService, UploadedImage } from '../../files/files.service';
import {
  MAX_LISTING_PHOTOS,
  OWNER_PHOTO_QUOTA,
  validatePublication,
  validateSubmission,
} from './publication.schema';

@Injectable()
export class RealEstateService {
  private readonly logger = new Logger(RealEstateService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

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
    return {
      data: data.map((item) => this.publicListing(item)),
      meta: pagination.meta(total),
    };
  }

  async findPublicOne(id: string) {
    const listing = await this.prisma.realEstateListing.findFirst({
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
    if (!listing) throw new NotFoundException('Annonce introuvable.');
    return this.publicListing(listing);
  }

  private publicListing<
    T extends { metadata: unknown; ownerUserId: string; deletedAt: unknown },
  >(listing: T) {
    const { ownerUserId, deletedAt, metadata: raw, ...data } = listing;
    const metadata = (raw || {}) as Record<string, any>;
    const publication = metadata.publication || {};
    const preferences = publication.contactPreferences || {};
    const contactPreferences = Object.fromEntries(
      Object.entries(preferences).filter(
        ([key]) =>
          [
            'whatsappEnabled',
            'phoneEnabled',
            'emailEnabled',
            'internalMessagingEnabled',
            'contactFormEnabled',
            'visitRequestEnabled',
          ].includes(key) ||
          (key === 'whatsappNumber' && preferences.whatsappEnabled) ||
          (key === 'phoneNumber' && preferences.phoneEnabled) ||
          (key === 'contactEmail' && preferences.emailEnabled),
      ),
    );
    return {
      ...data,
      metadata: {
        ...Object.fromEntries(
          ['photos', 'coverPhoto', 'surface', 'bedrooms', 'bathrooms', 'region']
            .filter((key) => metadata[key] !== undefined)
            .map((key) => [key, metadata[key]]),
        ),
        features: publication.features,
        conditions: publication.conditions,
        pricePeriod: publication.pricing?.pricePeriod,
        negotiable: publication.pricing?.negotiable,
        contactPreferences,
      },
    };
  }

  async createVisitRequest(listingId: string, dto: CreateVisitRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, listingId);
      const listing = await tx.realEstateListing.findFirst({
        where: { id: listingId, status: ListingStatus.active, deletedAt: null },
      });
      if (!listing) throw new NotFoundException('Annonce introuvable.');
      const metadata = (listing.metadata || {}) as Record<string, any>;
      if (
        metadata.publication?.contactPreferences?.visitRequestEnabled === false
      ) {
        throw new BadRequestException(
          'Les demandes de visite ne sont pas activées pour cette annonce.',
        );
      }
      const request = await tx.realEstateVisitRequest.create({
        data: {
          listingId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          preferredDate: dto.preferredDate
            ? new Date(dto.preferredDate)
            : undefined,
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
      this.prisma.realEstateListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: 'desc' },
      }),
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

  async updateVisitRequestStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateVisitRequestStatusDto,
  ) {
    const request = await this.prisma.realEstateVisitRequest.findFirstOrThrow({
      where: {
        id,
        listing: {
          ownerUserId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    return this.prisma.realEstateVisitRequest.update({
      where: { id: request.id },
      data: { status: dto.status as RequestStatus },
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
    });
  }

  private parse(dto: CreateRealEstateDto) {
    const { requestId, ...value } = dto;
    return validatePublication(value);
  }

  private listingData(
    dto: ReturnType<typeof validatePublication>,
    existing: Record<string, any> = {},
  ) {
    const previous = existing.publication || {};
    const publication = { ...previous, ...dto.metadata };
    return {
      title: dto.title ?? '',
      description: dto.description ?? '',
      transaction: dto.transaction ?? null,
      propertyType: dto.propertyType ?? null,
      city: publication.location?.city || '',
      neighborhood: publication.location?.district || null,
      price: publication.pricing?.price ?? null,
      currency: 'FCFA',
      metadata: JSON.parse(
        JSON.stringify({
          ...existing,
          publication,
          region: publication.location?.region,
          surface: publication.features?.surface,
          bedrooms: publication.features?.bedrooms,
          bathrooms: publication.features?.bathrooms,
        }),
      ) as Prisma.InputJsonValue,
    };
  }

  async create(ownerUserId: string, dto: CreateRealEstateDto) {
    const value = this.parse(dto);
    const id = dto.requestId
      ? `re_${createHash('sha256').update(`${ownerUserId}:${dto.requestId}`).digest('hex')}`
      : randomUUID();
    const slug = `${(value.title || 'annonce')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 70)}-${randomUUID()}`;
    const listing = await this.prisma.realEstateListing.upsert({
      where: { id },
      update: {},
      create: { id, ownerUserId, slug, ...this.listingData(value) },
    });
    if (listing.deletedAt)
      throw new ConflictException('Ce brouillon a été supprimé.');
    return listing;
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "RealEstateListing" WHERE "id" = ${id} FOR UPDATE`;
  }

  private async owned(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
    editable = false,
  ) {
    const listing = await tx.realEstateListing.findFirst({
      where: { id, ownerUserId, deletedAt: null },
    });
    if (!listing) throw new NotFoundException('Annonce introuvable.');
    if (
      editable &&
      !['draft', 'refused', 'active', 'pending_review'].includes(listing.status)
    ) {
      throw new ConflictException(
        'Cette annonce ne peut pas être modifiée dans son état actuel.',
      );
    }
    return listing;
  }

  async findOwned(ownerUserId: string, id: string) {
    const listing = await this.owned(this.prisma, ownerUserId, id);
    const photos = await this.prisma.fileAsset.findMany({
      where: {
        ownerUserId,
        deletedAt: null,
        module: PencmiModule.real_estate,
        usages: { some: { targetType: TargetType.listing, targetId: id } },
      },
      select: { id: true, publicUrl: true },
    });
    const metadata = (listing.metadata || {}) as Record<string, any>;
    const allPhotos = [
      ...photos.map((photo) => ({
        id: photo.id,
        url: photo.publicUrl,
        legacy: false,
      })),
      ...this.legacyPhotos(metadata),
    ];
    const orderedIds = this.orderedPhotoIds(metadata);
    allPhotos.sort(
      (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id),
    );
    return {
      ...listing,
      photos: allPhotos,
    };
  }

  async update(ownerUserId: string, id: string, dto: UpdateRealEstateDto) {
    const value = this.parse(dto);
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const listing = await this.owned(tx, ownerUserId, id, true);
      const data = this.listingData(
        {
          title: listing.title,
          description: listing.description || '',
          transaction: listing.transaction as typeof value.transaction,
          propertyType: listing.propertyType as typeof value.propertyType,
          ...value,
        },
        (listing.metadata || {}) as Record<string, any>,
      );
      return tx.realEstateListing.update({
        where: { id },
        data: { ...data, status: ListingStatus.draft },
      });
    });
  }

  async submit(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const listing = await this.owned(tx, ownerUserId, id, true);
      const metadata = (listing.metadata || {}) as Record<string, any>;
      const value = validatePublication({
        title: listing.title,
        description: listing.description,
        transaction: listing.transaction || undefined,
        propertyType: listing.propertyType || undefined,
        metadata: metadata.publication || {},
      });
      validateSubmission(value);
      return tx.realEstateListing.update({
        where: { id },
        data: { status: ListingStatus.pending_review },
      });
    });
  }

  private legacyPhotos(metadata: Record<string, any>) {
    const urls: unknown[] =
      metadata.legacyPhotos || (metadata.photoIds ? [] : metadata.photos || []);
    return [
      ...new Set(
        urls.filter(
          (url): url is string =>
            typeof url === 'string' && /^https?:\/\//.test(url),
        ),
      ),
    ].map((url) => ({
      id: `legacy_${createHash('sha256').update(url).digest('hex')}`,
      url,
      legacy: true,
    }));
  }

  private orderedPhotoIds(metadata: Record<string, any>): string[] {
    const ids = [
      ...(metadata.photoIds || []),
      ...this.legacyPhotos(metadata).map((photo) => photo.id),
    ];
    const order: string[] = metadata.photoOrder || [];
    return [
      ...order.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !order.includes(id)),
    ];
  }

  private async photoMetadata(
    tx: Prisma.TransactionClient,
    listingId: string,
    metadata: Record<string, any>,
    ids: string[],
  ) {
    const legacy = this.legacyPhotos(metadata);
    const managedIds = ids.filter(
      (id) => !legacy.some((photo) => photo.id === id),
    );
    const assets = await tx.fileAsset.findMany({
      where: {
        id: { in: managedIds },
        deletedAt: null,
        usages: {
          some: { targetType: TargetType.listing, targetId: listingId },
        },
      },
    });
    if (assets.length !== managedIds.length)
      throw new BadRequestException('Ordre des photos invalide.');
    const legacyPhotos = ids
      .filter((id) => legacy.some((photo) => photo.id === id))
      .map((id) => legacy.find((photo) => photo.id === id)!.url);
    const photos = ids.map(
      (id) =>
        legacy.find((photo) => photo.id === id)?.url ||
        assets.find((asset) => asset.id === id)!.publicUrl!,
    );
    return {
      ...metadata,
      legacyPhotos,
      photoIds: managedIds,
      photoOrder: ids,
      photos,
      coverPhoto: photos[0] || null,
    } as Prisma.InputJsonValue;
  }

  async uploadPhoto(
    ownerUserId: string,
    listingId: string,
    uploadId: string,
    file: UploadedImage,
    replacePhotoId?: string,
  ) {
    const image = await this.files.prepareListingPhoto(file);
    const id = `photo_${createHash('sha256').update(`${listingId}:${uploadId}`).digest('hex')}`;
    let storedAsset: FileAsset | undefined;
    const uploaded = await this.prisma
      .$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerUserId} FOR UPDATE`;
          await this.lock(tx, listingId);
          const listing = await this.owned(tx, ownerUserId, listingId, true);
          const existing = await tx.fileAsset.findFirst({
            where: { id, ownerUserId },
          });
          if (existing?.deletedAt)
            throw new ConflictException('Cette photo a déjà été retirée.');
          if (existing) return { id: existing.id, url: existing.publicUrl };
          const metadata = (listing.metadata || {}) as Record<string, any>;
          const ids = this.orderedPhotoIds(metadata);
          if (replacePhotoId && !ids.includes(replacePhotoId))
            throw new NotFoundException('Photo introuvable.');
          if (!replacePhotoId && ids.length >= MAX_LISTING_PHOTOS)
            throw new BadRequestException('Maximum 12 photos par annonce.');
          const usage = await tx.fileAsset.aggregate({
            where: { ownerUserId, module: PencmiModule.real_estate },
            _sum: { sizeBytes: true },
          });
          if ((usage._sum.sizeBytes || 0) + image.size > OWNER_PHOTO_QUOTA)
            throw new BadRequestException('Quota photo de 100 Mo atteint.');
          const asset = await this.files.storeListingPhoto(
            tx,
            ownerUserId,
            listingId,
            id,
            image,
          );
          storedAsset = asset;
          const ordered = replacePhotoId
            ? ids.map((item) => (item === replacePhotoId ? id : item))
            : [...ids, id];
          if (replacePhotoId && !replacePhotoId.startsWith('legacy_'))
            await tx.fileAsset.update({
              where: { id: replacePhotoId },
              data: { deletedAt: new Date() },
            });
          await tx.realEstateListing.update({
            where: { id: listingId },
            data: {
              metadata: await this.photoMetadata(
                tx,
                listingId,
                metadata,
                ordered,
              ),
              status: ListingStatus.draft,
            },
          });
          return { id: asset.id, url: asset.publicUrl };
        },
        { timeout: 30000 },
      )
      .catch(async (error) => {
        if (storedAsset) {
          const candidate = storedAsset;
          try {
            // A failed acknowledgement may follow a commit; verify under lock before cleanup.
            await this.prisma.$transaction(
              async (tx) => {
                await this.lock(tx, listingId);
                const persisted = await tx.fileAsset.findFirst({
                  where: { id: candidate.id, storageKey: candidate.storageKey },
                });
                if (!persisted) await this.files.discardPhotoBinary(candidate);
              },
              { timeout: 30000 },
            );
          } catch {
            this.logger.warn(
              `Nettoyage du fichier immobilier à reprendre : ${candidate.id}`,
            );
          }
        }
        throw error;
      });
    if (replacePhotoId)
      await this.files.purgeDeletedListingPhoto(replacePhotoId, ownerUserId);
    return uploaded;
  }

  async orderPhotos(ownerUserId: string, id: string, photoIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const listing = await this.owned(tx, ownerUserId, id, true);
      const metadata = (listing.metadata || {}) as Record<string, any>;
      const previous = this.orderedPhotoIds(metadata);
      if (
        photoIds.length !== previous.length ||
        previous.some((item) => !photoIds.includes(item))
      )
        throw new BadRequestException('Ordre des photos invalide.');
      return tx.realEstateListing.update({
        where: { id },
        data: {
          metadata: await this.photoMetadata(tx, id, metadata, photoIds),
          status: ListingStatus.draft,
        },
      });
    });
  }

  async deletePhoto(ownerUserId: string, id: string, photoId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      const listing = await this.owned(tx, ownerUserId, id, true);
      const metadata = (listing.metadata || {}) as Record<string, any>;
      const ids = this.orderedPhotoIds(metadata);
      if (!ids.includes(photoId))
        throw new NotFoundException('Photo introuvable.');
      await tx.fileAsset.updateMany({
        where: { id: photoId, ownerUserId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      await tx.realEstateListing.update({
        where: { id },
        data: {
          metadata: await this.photoMetadata(
            tx,
            id,
            metadata,
            ids.filter((item) => item !== photoId),
          ),
          status: ListingStatus.draft,
        },
      });
      return { deleted: true };
    });
    await this.files.purgeDeletedListingPhoto(photoId, ownerUserId);
    return result;
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, id);
      await this.owned(tx, ownerUserId, id);
      return tx.realEstateListing.updateMany({
        where: { id, ownerUserId, deletedAt: null },
        data: { status: ListingStatus.deleted, deletedAt: new Date() },
      });
    });
  }
}
