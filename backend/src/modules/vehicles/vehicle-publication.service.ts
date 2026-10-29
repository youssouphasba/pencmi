import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FileAsset, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService, UploadedImage } from '../../files/files.service';
import { CreateVehicleDto, VehiclePhotoDto } from './vehicles.dto';
import {
  validateVehiclePublication,
  validateVehicleSubmission,
  VehiclePublication,
  VEHICLE_PHOTO_LIMIT,
  VEHICLE_PHOTO_QUOTA,
  vehiclePrimaryPrice,
} from './vehicle-publication.schema';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const vehicleObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};

export function vehiclePublicationFromListing(listing: any) {
  const metadata = vehicleObject(listing.metadata);
  const publication = vehicleObject(metadata.publication);
  return {
    identity:
      publication.identity ||
      Object.fromEntries(
        ['brand', 'model', 'version', 'year']
          .filter((key) => metadata[key] !== undefined)
          .map((key) => [key, metadata[key]]),
      ),
    info:
      publication.info ||
      Object.fromEntries(
        [
          'mileage',
          'fuel',
          'gearbox',
          'category',
          'seats',
          'color',
          'condition',
          'power',
        ]
          .filter((key) => metadata[key] !== undefined)
          .map((key) => [key, metadata[key]]),
      ),
    location: publication.location || {
      region: metadata.region,
      city: listing.city || '',
      district: metadata.district,
      addressHint: metadata.addressHint,
    },
    pricing: publication.pricing || {
      ...(listing.vehicleMode === 'sale'
        ? { price: listing.price ?? undefined }
        : listing.vehicleMode === 'rental'
          ? { pricePerDay: listing.price ?? undefined }
          : { pricePerTrip: listing.price ?? undefined }),
      ...Object.fromEntries(
        [
          'negotiable',
          'pricePerWeek',
          'pricePerMonth',
          'deposit',
          'includedMileage',
          'coveredAreas',
          'chauffeurPriceUnit',
          'serviceConditions',
          'rentalConditions',
        ]
          .filter((key) => metadata[key] !== undefined)
          .map((key) => [key, metadata[key]]),
      ),
      currency: 'FCFA',
    },
    equipment:
      publication.equipment ||
      (Array.isArray(metadata.options) ? metadata.options : []),
    documents:
      publication.documents ||
      (Array.isArray(metadata.documents)
        ? metadata.documents.filter((item) => typeof item === 'string')
        : []),
    conditions:
      publication.conditions ??
      (typeof metadata.conditions === 'string' ? metadata.conditions : ''),
    contactPreferences: publication.contactPreferences || {},
  };
}

@Injectable()
export class VehiclePublicationService {
  private readonly logger = new Logger(VehiclePublicationService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private async owned(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
    edit = false,
  ) {
    const listing = await tx.vehicleListing.findFirst({
      where: { id, ownerUserId, deletedAt: null },
    });
    if (!listing) throw new NotFoundException('Annonce introuvable.');
    if (
      edit &&
      !['draft', 'refused', 'active', 'pending_review'].includes(listing.status)
    )
      throw new ConflictException(
        'Cette annonce ne peut pas être modifiée dans son état actuel.',
      );
    return listing;
  }
  private async lock(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
    return this.owned(tx, ownerUserId, id, true);
  }
  private async photos(tx: Prisma.TransactionClient, listing: any) {
    const metadata = vehicleObject(listing.metadata);
    const assets = await tx.fileAsset.findMany({
      where: {
        ownerUserId: listing.ownerUserId,
        module: 'vehicles',
        deletedAt: null,
        usages: { some: { targetType: 'listing', targetId: listing.id } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const legacy = Array.isArray(metadata.legacyPhotos)
      ? metadata.legacyPhotos
      : metadata.photoIds
        ? []
        : [
            ...(Array.isArray(metadata.photos) ? metadata.photos : []),
            metadata.coverPhoto,
          ];
    const all = [
      ...assets.map((asset) => ({
        id: asset.id,
        url: asset.publicUrl!,
        managed: true,
      })),
      ...[
        ...new Set<string>(
          legacy.filter(
            (url: unknown) =>
              typeof url === 'string' && /^https?:\/\//.test(url as string),
          ),
        ),
      ].map((url) => ({ id: `legacy_${digest(url)}`, url, managed: false })),
    ];
    const order: string[] = Array.isArray(metadata.photoOrder)
      ? metadata.photoOrder
      : [];
    const index = (id: string) =>
      order.includes(id)
        ? order.indexOf(id)
        : order.length + all.findIndex((photo) => photo.id === id);
    return all.sort((a, b) => index(a.id) - index(b.id));
  }
  async findOwned(ownerUserId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const listing = await this.owned(tx, ownerUserId, id);
        return {
          ...listing,
          publication: vehiclePublicationFromListing(listing),
          photos: await this.photos(tx, listing),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }
  private data(input: VehiclePublication, previous?: any) {
    const metadata = vehicleObject(previous?.metadata);
    const publication = {
      ...vehiclePublicationFromListing(previous || {}),
      ...input.metadata,
    };
    for (const section of [
      'identity',
      'info',
      'location',
      'pricing',
      'contactPreferences',
    ] as const) {
      publication[section] = {
        ...vehicleObject(
          vehiclePublicationFromListing(previous || {})[section],
        ),
        ...vehicleObject(input.metadata?.[section]),
      };
    }
    const vehicleMode = input.vehicleMode ?? previous?.vehicleMode ?? '';
    return {
      title: input.title ?? previous?.title ?? '',
      description: input.description ?? previous?.description ?? '',
      vehicleMode,
      city: publication.location?.city || '',
      price:
        vehiclePrimaryPrice(vehicleMode, publication.pricing || {}) ?? null,
      currency: 'FCFA',
      metadata: JSON.parse(
        JSON.stringify({ ...metadata, publication }),
      ) as Prisma.InputJsonValue,
    };
  }
  async create(ownerUserId: string, dto: CreateVehicleDto) {
    const { requestId, ...body } = dto;
    const input = validateVehiclePublication(body);
    const id = requestId
      ? `vehicle_${digest(`${ownerUserId}:${requestId}`)}`
      : randomUUID();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.vehicleListing.createMany({
          data: [
            { id, ownerUserId, slug: `vehicule-${id}`, ...this.data(input) },
          ],
          skipDuplicates: true,
        });
        await this.owned(tx, ownerUserId, id);
      },
      { timeout: 15000 },
    );
    return this.findOwned(ownerUserId, id);
  }
  async update(ownerUserId: string, id: string, dto: CreateVehicleDto) {
    const { requestId, ...body } = dto;
    const input = validateVehiclePublication(body);
    await this.prisma.$transaction(
      async (tx) => {
        const listing = await this.lock(tx, ownerUserId, id);
        if (input.vehicleMode && input.vehicleMode !== listing.vehicleMode) {
          const [rental, chauffeur] = await Promise.all([
            tx.vehicleRentalRequest.count({
              where: { listingId: id, status: 'accepted' },
            }),
            tx.vehicleChauffeurRequest.count({
              where: { listingId: id, status: 'accepted' },
            }),
          ]);
          if (rental || chauffeur)
            throw new ConflictException(
              'Traitez les demandes acceptées avant de changer le type d’annonce.',
            );
        }
        await tx.vehicleListing.update({
          where: { id },
          data: { ...this.data(input, listing), status: 'draft' },
        });
      },
      { timeout: 20000 },
    );
    return this.findOwned(ownerUserId, id);
  }
  async submit(ownerUserId: string, id: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const listing = await this.lock(tx, ownerUserId, id);
        const input = validateVehiclePublication({
          vehicleMode: listing.vehicleMode || undefined,
          title: listing.title,
          description: listing.description ?? '',
          metadata: vehiclePublicationFromListing(listing),
        });
        validateVehicleSubmission(input);
        await tx.vehicleListing.update({
          where: { id },
          data: { status: 'pending_review' },
        });
      },
      { timeout: 15000 },
    );
    return this.findOwned(ownerUserId, id);
  }
  private async savePhotos(
    tx: Prisma.TransactionClient,
    listing: any,
    photos: { id: string; url: string; managed: boolean }[],
  ) {
    await tx.vehicleListing.update({
      where: { id: listing.id },
      data: {
        status: 'draft',
        metadata: {
          ...vehicleObject(listing.metadata),
          photoOrder: photos.map((photo) => photo.id),
          photoIds: photos
            .filter((photo) => photo.managed)
            .map((photo) => photo.id),
          legacyPhotos: photos
            .filter((photo) => !photo.managed)
            .map((photo) => photo.url),
          photos: photos.map((photo) => photo.url),
          coverPhoto: photos[0]?.url || null,
        } as Prisma.InputJsonValue,
      },
    });
  }
  async photo(
    ownerUserId: string,
    id: string,
    dto: VehiclePhotoDto,
    file: UploadedImage,
  ) {
    await this.owned(this.prisma, ownerUserId, id, true);
    const image = await this.files.prepareListingPhoto(file);
    const photoId = `vp_${digest(`${id}:${dto.uploadId}`)}`;
    let stored: FileAsset | undefined;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerUserId} FOR UPDATE`;
          const listing = await this.lock(tx, ownerUserId, id);
          const existing = await tx.fileAsset.findUnique({
            where: { id: photoId },
          });
          if (existing) {
            if (existing.deletedAt)
              throw new ConflictException('Cette photo a déjà été supprimée.');
            return;
          }
          const photos = await this.photos(tx, listing);
          if (
            dto.replacePhotoId &&
            !photos.some((photo) => photo.id === dto.replacePhotoId)
          )
            throw new NotFoundException('Photo à remplacer introuvable.');
          if (!dto.replacePhotoId && photos.length >= VEHICLE_PHOTO_LIMIT)
            throw new BadRequestException('Limite de 30 photos atteinte.');
          const usage = await tx.fileAsset.aggregate({
            where: { ownerUserId, module: 'vehicles' },
            _sum: { sizeBytes: true },
          });
          if ((usage._sum.sizeBytes || 0) + image.size > VEHICLE_PHOTO_QUOTA)
            throw new BadRequestException('Quota photo de 150 Mo atteint.');
          stored = await this.files.storeListingPhoto(
            tx,
            ownerUserId,
            id,
            photoId,
            image,
            'vehicles',
          );
          const photo = { id: photoId, url: stored.publicUrl!, managed: true };
          const next = dto.replacePhotoId
            ? photos.map((item) =>
                item.id === dto.replacePhotoId ? photo : item,
              )
            : [...photos, photo];
          if (
            dto.replacePhotoId &&
            photos.some(
              (item) => item.id === dto.replacePhotoId && item.managed,
            )
          )
            await tx.fileAsset.update({
              where: { id: dto.replacePhotoId },
              data: { deletedAt: new Date() },
            });
          await this.savePhotos(tx, listing, next);
        },
        { maxWait: 15000, timeout: 60000 },
      );
    } catch (error) {
      if (stored) {
        const candidate = stored;
        try {
          await this.prisma.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id} FOR UPDATE`;
              const persisted = await tx.fileAsset.findFirst({
                where: { id: candidate.id, storageKey: candidate.storageKey },
              });
              if (!persisted) await this.files.discardPhotoBinary(candidate);
            },
            { timeout: 30000 },
          );
        } catch {
          this.logger.warn('Nettoyage d’une photo automobile à reprendre.');
        }
      }
      throw error;
    }
    if (dto.replacePhotoId)
      await this.files.purgeDeletedListingPhoto(
        dto.replacePhotoId,
        ownerUserId,
        'vehicles',
      );
    return this.findOwned(ownerUserId, id);
  }
  async reorder(ownerUserId: string, id: string, order: string[]) {
    await this.prisma.$transaction(
      async (tx) => {
        const listing = await this.lock(tx, ownerUserId, id);
        const photos = await this.photos(tx, listing);
        if (
          order.length !== photos.length ||
          new Set(order).size !== order.length ||
          order.some((value) => !photos.some((photo) => photo.id === value))
        )
          throw new BadRequestException('Ordre des photos invalide.');
        await this.savePhotos(
          tx,
          listing,
          order.map((value) => photos.find((photo) => photo.id === value)!),
        );
      },
      { timeout: 15000 },
    );
    return this.findOwned(ownerUserId, id);
  }
  async removePhoto(ownerUserId: string, id: string, photoId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const listing = await this.lock(tx, ownerUserId, id);
        const photos = await this.photos(tx, listing);
        const photo = photos.find((item) => item.id === photoId);
        if (!photo) throw new NotFoundException('Photo introuvable.');
        if (photo.managed)
          await tx.fileAsset.update({
            where: { id: photoId },
            data: { deletedAt: new Date() },
          });
        await this.savePhotos(
          tx,
          listing,
          photos.filter((item) => item.id !== photoId),
        );
      },
      { timeout: 15000 },
    );
    await this.files.purgeDeletedListingPhoto(photoId, ownerUserId, 'vehicles');
    return this.findOwned(ownerUserId, id);
  }
}
