import { lockRequestAccounts } from '../../common/utils/request-account-lock';
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
import { clientRequestId, assertSameClientRequest, CLIENT_REQUEST_TRANSACTION } from '../../common/utils/client-request-retry';
import { notifyClientRequestStatus } from '../../common/utils/client-request-notification';
import {
  CreateRealEstateDto,
  CreateVisitRequestDto,
  RealEstateSearchDto,
  UpdateRealEstateDto,
  UpdateVisitRequestStatusDto,
  VisitRequestMessageDto,
} from './real-estate.dto';
import { ConversationsService } from '../conversations/conversations.service';
import { FilesService, UploadedImage } from '../../files/files.service';
import {
  MAX_LISTING_PHOTOS,
  OWNER_PHOTO_QUOTA,
  validatePublication,
  validateSubmission,
} from './publication.schema';

export function validateStoredRealEstatePublication(listing: Pick<import('@prisma/client').RealEstateListing, 'title' | 'description' | 'transaction' | 'propertyType' | 'metadata'>) {
  const metadata = listing.metadata;
  const publication = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata.publication : undefined;
  const value = validatePublication({
    title: listing.title,
    description: listing.description ?? '',
    transaction: listing.transaction || undefined,
    propertyType: listing.propertyType || undefined,
    metadata: publication ?? {},
  });
  validateSubmission(value);
  return value;
}

@Injectable()
export class RealEstateService {
  private readonly logger = new Logger(RealEstateService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly conversations: ConversationsService,
  ) {}

  async findPublic(query: RealEstateSearchDto) {
    const pagination = getPagination(query);
    const where: Prisma.RealEstateListingWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      transaction: query.transaction || undefined,
      propertyType: query.propertyType || undefined,
      // Budget and furnished are filtered in SQL so that pagination and the
      // total reflect the search; listings without a price never match a budget.
      price: query.maxPrice ? { lte: query.maxPrice } : undefined,
      metadata:
        query.furnished === 'true'
          ? { path: ['publication', 'features', 'furnished'], equals: true }
          : undefined,
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
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
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

  async createVisitRequest(listingId: string, dto: CreateVisitRequestDto, clientUserId?: string) {
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
      const fields = {
        listingId,
        clientUserId: clientUserId ?? null,
        clientName: dto.clientName ?? null,
        clientPhone: dto.clientPhone ?? null,
        clientEmail: dto.clientEmail ?? null,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
        message: dto.message ?? null,
      };
      const id = clientRequestId('visit', listingId, dto.requestId);
      const previous = id
        ? await tx.realEstateVisitRequest.findUnique({ where: { id } })
        : await tx.realEstateVisitRequest.findFirst({ where: { ...fields, createdAt: { gte: new Date(Date.now() - 120000) } } });
      if (previous) {
        assertSameClientRequest(previous, fields);
        return previous;
      }
      await lockRequestAccounts(tx, listing.ownerUserId, clientUserId);
      const request = await tx.realEstateVisitRequest.create({
        data: { ...fields, ...(id ? { id } : {}) },
      });
      await tx.contactEvent.create({
        data: {
          ownerUserId: listing.ownerUserId,
          module: PencmiModule.real_estate,
          source: ContactSource.visit_request,
          targetType: TargetType.listing,
          targetId: listingId,
          metadata: { requestId: request.id },
        },
      });
      return request;
    }, CLIENT_REQUEST_TRANSACTION);
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
    const note = dto.message?.trim() || '';
    if (dto.status === 'pending' && !dto.proposedDate)
      throw new BadRequestException('Choisissez la date de visite à proposer.');
    if (dto.status === 'requires_more_info' && !note)
      throw new BadRequestException('Écrivez la précision que vous attendez du client.');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RealEstateVisitRequest" WHERE "id" = ${id} FOR UPDATE`;
      const request = await tx.realEstateVisitRequest.findFirst({
        where: {
          id,
          listing: { ownerUserId, deletedAt: null },
        },
      });
      if (!request) throw new NotFoundException('Demande introuvable.');

      const updated = await tx.realEstateVisitRequest.update({
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
      await notifyClientRequestStatus(tx, 'visit', request, dto.status);
      return updated;
    });
    // A proposed slot or a question reaches the client in the conversation, not only as a status.
    const body = visitStatusMessage(dto, note);
    if (!body) return updated;
    if (!updated.clientUserId) return { ...updated, messageDelivered: false };
    const sent = await this.conversations.writeToRequester(ownerUserId, 'real_estate', updated.listingId, updated.clientUserId, body,
      dto.requestId ?? randomUUID());
    return { ...updated, messageDelivered: true, conversationId: sent.conversationId };
  }

  /** "Écrire au client": only to someone who sent a visit request on one of this owner's listings. */
  async messageVisitRequester(ownerUserId: string, id: string, dto: VisitRequestMessageDto) {
    const request = await this.prisma.realEstateVisitRequest.findFirst({
      where: { id, listing: { ownerUserId, deletedAt: null } },
      select: { listingId: true, clientUserId: true },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (!request.clientUserId)
      throw new ConflictException('Ce client n’a pas de compte Péncmi : contactez-le par téléphone ou par email.');
    return this.conversations.writeToRequester(ownerUserId, 'real_estate', request.listingId, request.clientUserId, dto.body.trim(), dto.requestId);
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
    const listing = await this.prisma.realEstateListing
      .upsert({
        where: { id },
        update: {},
        create: { id, ownerUserId, slug, ...this.listingData(value) },
      })
      .catch(async (error) => {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002' ||
          !Array.isArray(error.meta?.target) ||
          error.meta.target.length !== 1 ||
          error.meta.target[0] !== 'id'
        )
          throw error;
        return this.prisma.realEstateListing.findFirstOrThrow({
          where: { id, ownerUserId },
        });
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
      validateStoredRealEstatePublication(listing);
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

function visitStatusMessage(dto: UpdateVisitRequestStatusDto, note: string) {
  if (dto.status === 'pending' && dto.proposedDate) {
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${dto.proposedDate}T00:00:00Z`));
    return [`Je vous propose une visite le ${day}${dto.proposedTime ? ` à ${dto.proposedTime.replace(':', 'h')}` : ''}.`, note,
      'Répondez-moi ici pour confirmer ou proposer un autre moment.'].filter(Boolean).join('\n\n');
  }
  if (dto.status === 'requires_more_info') return `Pour votre demande de visite : ${note}`;
  return note;
}
