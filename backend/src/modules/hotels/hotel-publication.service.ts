import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileAsset, ListingStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService, UploadedImage } from '../../files/files.service';
import { CreateHotelDto, HotelPhotoDto } from './hotels.dto';
import {
  HOTEL_OWNER_PHOTO_QUOTA,
  HOTEL_PHOTO_LIMIT,
  HotelPublication,
  hotelPeriodDays,
  validateHotelPublication,
  validateHotelSubmission,
} from './hotel-publication.schema';
import {
  activeHotelAllocations,
  assertHotelAllocatedInventory,
} from './hotel-inventory';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const hotelRoomsInclude = {
  rates: { orderBy: { date: 'asc' as const } },
  availability: { orderBy: { date: 'asc' as const } },
  restrictions: true,
  stockAllocations: activeHotelAllocations,
} satisfies Prisma.HotelRoomInclude;
export function hotelSettings(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
export function hotelRoomDraft(room: any) {
  const { draftRates, draftCalendar, ...metadata } = hotelSettings(
    room.metadata,
  );
  return {
    id: room.id,
    name: room.name,
    roomType: room.roomType || '',
    capacity: room.capacity ?? undefined,
    ...metadata,
    enabled: room.status === 'active',
    rates:
      draftRates ??
      room.rates
        .filter((rate: any) => rate.ratePlan === 'manual')
        .map((rate: any) => ({
          start: rate.date.toISOString().slice(0, 10),
          end: rate.date.toISOString().slice(0, 10),
          price: rate.price,
          currency: 'FCFA',
        })),
    calendar:
      draftCalendar ??
      room.availability.map((day: any) => {
        const restriction = room.restrictions.find(
          (item: any) => item.date.valueOf() === day.date.valueOf(),
        );
        return {
          start: day.date.toISOString().slice(0, 10),
          end: day.date.toISOString().slice(0, 10),
          available: day.available,
          status: day.status,
          stopSell: restriction?.stopSell || false,
          minStay: restriction?.minStay ?? undefined,
          maxStay: restriction?.maxStay ?? undefined,
        };
      }),
  };
}

@Injectable()
export class HotelPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private async lock(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "HotelProperty" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "HotelIntegration" WHERE "propertyId" = ${id} FOR UPDATE`;
    const property = await tx.hotelProperty.findFirst({
      where: { id, ownerUserId, deletedAt: null },
      include: {
        integration: { include: { fieldMappings: true } },
        rooms: { include: hotelRoomsInclude },
      },
    });
    if (!property) throw new NotFoundException('Hébergement introuvable.');
    if (
      property.integration?.sourceOfTruth === 'external_system' &&
      property.integration.fieldMappings.length
    )
      throw new ConflictException(
        'Des champs sont pilotés par une intégration externe. Les modifications manuelles nécessitent une vérification de cette configuration.',
      );
    if (
      !['draft', 'refused', 'active', 'pending_review'].includes(
        property.status,
      )
    )
      throw new ConflictException(
        'Cet hébergement ne peut pas être modifié dans son état actuel.',
      );
    return property;
  }

  async owned(ownerUserId: string, id: string) {
    const property = await this.prisma.hotelProperty.findFirst({
      where: { id, ownerUserId, deletedAt: null },
      include: {
        rooms: { include: hotelRoomsInclude },
        integration: { select: { sourceOfTruth: true } },
      },
    });
    if (!property) throw new NotFoundException('Hébergement introuvable.');
    const { integration, ...data } = property;
    const assets = await this.prisma.fileAsset.findMany({
      where: {
        ownerUserId,
        module: 'hotels',
        deletedAt: null,
        usages: { some: { targetType: 'listing', targetId: id } },
      },
    });
    const settings = hotelSettings(property.contactSettings);
    const order: string[] = settings.photoIds || [];
    const photos = assets.map((asset) => ({
      id: asset.id,
      url: asset.publicUrl,
      roomId: hotelSettings(asset.metadata).roomId || null,
      managed: true,
    }));
    const legacy: string[] = Array.isArray(settings.legacyPhotos)
      ? settings.legacyPhotos
      : Array.isArray(settings.photos) && !order.length
        ? settings.photos
        : [];
    photos.push(
      ...legacy
        .filter((url) => typeof url === 'string' && /^https?:\/\//.test(url))
        .map((url) => ({
          id: `legacy_${digest(url)}`,
          url,
          roomId: null,
          managed: false,
        })),
    );
    photos.sort(
      (a, b) =>
        (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) -
        (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)),
    );
    return {
      ...data,
      metadata: settings,
      rooms: property.rooms.map(hotelRoomDraft),
      photos,
      externalInventory: integration?.sourceOfTruth === 'external_system',
    };
  }

  async create(ownerUserId: string, dto: CreateHotelDto) {
    const { requestId, ...input } = dto;
    const data = validateHotelPublication(input);
    const id = `hotel_${digest(`${ownerUserId}:${requestId || randomUUID()}`)}`;
    await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.hotelProperty.createMany({
          skipDuplicates: true,
          data: [
            {
              id,
              ownerUserId,
              slug: `hebergement-${id.slice(6)}`,
              name: '',
              city: '',
              propertyType: '',
              status: 'draft',
            },
          ],
        });
        await this.lock(tx, ownerUserId, id);
        // A retried creation must not overwrite a subsequently edited draft.
        if (created.count) await this.write(tx, ownerUserId, id, data);
      },
      { timeout: 30000 },
    );
    return this.owned(ownerUserId, id);
  }

  async update(ownerUserId: string, id: string, dto: CreateHotelDto) {
    const { requestId, ...input } = dto;
    const data = validateHotelPublication(input);
    await this.prisma.$transaction(
      (tx) => this.write(tx, ownerUserId, id, data),
      { timeout: 30000 },
    );
    return this.owned(ownerUserId, id);
  }

  private async write(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
    data: HotelPublication,
  ) {
    const property = await this.lock(tx, ownerUserId, id);
    if (
      property.integration?.sourceOfTruth === 'external_system' &&
      data.rooms !== undefined
    )
      throw new ConflictException(
        'Les chambres, tarifs et disponibilités sont gérés par le logiciel hôtelier.',
      );
    if (
      property.integration?.sourceOfTruth === 'external_system' &&
      (['name', 'propertyType', 'city', 'region'] as const).some(
        (key) => data[key] !== undefined && data[key] !== (property[key] || ''),
      )
    )
      throw new ConflictException(
        'Les informations synchronisées doivent être modifiées dans le logiciel hôtelier.',
      );
    const settings = hotelSettings(property.contactSettings);
    const publication = {
      ...hotelSettings(settings.publication),
      ...data.metadata,
    };
    const { rooms, metadata, ...fields } = data;
    await tx.hotelProperty.update({
      where: { id },
      data: {
        ...fields,
        status: 'draft',
        contactSettings: { ...settings, publication } as Prisma.InputJsonValue,
      },
    });
    for (const input of rooms || []) {
      const roomId = input.id || `room_${digest(`${id}:${input.clientId}`)}`;
      const existing = property.rooms.find((item) => item.id === roomId);
      if (input.id && !existing)
        throw new NotFoundException('Chambre introuvable.');
      if (existing) await assertHotelAllocatedInventory(tx, existing, input);
      const mapping = await tx.hotelExternalMapping.findFirst({
        where: { internalId: roomId },
      });
      if (mapping)
        throw new ConflictException(
          'Cette chambre est liée à une intégration externe.',
        );
      if (input.remove) {
        const dependentPhoto = await tx.fileAsset.findFirst({
          where: {
            module: 'hotels',
            deletedAt: null,
            metadata: { path: ['roomId'], equals: roomId },
            usages: { some: { targetType: 'listing', targetId: id } },
          },
          select: { id: true },
        });
        if (dependentPhoto)
          throw new ConflictException(
            'Cette chambre possède des photos. Désactivez-la au lieu de la supprimer.',
          );
        if (
          existing &&
          (existing.rates.length ||
            existing.availability.length ||
            existing.restrictions.length)
        )
          throw new ConflictException(
            'Cette chambre possède un historique. Désactivez-la au lieu de la supprimer.',
          );
        if (existing) await tx.hotelRoom.delete({ where: { id: roomId } });
        continue;
      }
      const {
        id: ignoredId,
        clientId,
        name,
        roomType,
        capacity,
        rates,
        calendar,
        enabled,
        remove,
        ...roomMetadata
      } = input;
      const priorMetadata = hotelSettings(existing?.metadata);
      if (
        input.calendar === undefined &&
        input.totalUnits !== undefined &&
        existing?.availability.some((day) => day.available > input.totalUnits!)
      )
        throw new ConflictException(
          'La quantité de chambres ne couvre pas le calendrier existant.',
        );
      const roomData = {
        name,
        roomType,
        capacity,
        status: enabled ? ListingStatus.active : ListingStatus.expired,
        metadata: {
          ...priorMetadata,
          ...roomMetadata,
          ...(rates !== undefined ? { draftRates: rates } : {}),
          ...(calendar !== undefined ? { draftCalendar: calendar } : {}),
        } as Prisma.InputJsonValue,
      };
      await tx.hotelRoom.upsert({
        where: { id: roomId },
        create: { id: roomId, propertyId: id, ...roomData },
        update: roomData,
      });
      if (rates !== undefined) {
        await tx.hotelRoomRate.deleteMany({
          where: { roomId, ratePlan: 'manual' },
        });
        const values = rates
          .filter(
            (period) =>
              period.start && period.end && period.price !== undefined,
          )
          .flatMap((period) =>
            hotelPeriodDays(period.start, period.end).map((day) => ({
              roomId,
              date: new Date(`${day}T00:00:00Z`),
              ratePlan: 'manual',
              price: period.price!,
              currency: 'FCFA',
            })),
          );
        if (values.length) await tx.hotelRoomRate.createMany({ data: values });
      }
      if (calendar !== undefined) {
        await tx.hotelRoomAvailability.deleteMany({ where: { roomId } });
        await tx.hotelRestriction.deleteMany({ where: { roomId } });
        for (const period of calendar) {
          const days = hotelPeriodDays(period.start, period.end);
          if (days.length) {
            await tx.hotelRoomAvailability.createMany({
              data: days.map((day) => ({
                roomId,
                date: new Date(`${day}T00:00:00Z`),
                available: period.available,
                status: period.status,
              })),
            });
            await tx.hotelRestriction.createMany({
              data: days.map((day) => ({
                roomId,
                date: new Date(`${day}T00:00:00Z`),
                stopSell: period.stopSell || period.status !== 'open',
                minStay: period.minStay,
                maxStay: period.maxStay,
              })),
            });
          }
        }
      }
    }
  }

  async submit(ownerUserId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const property = await this.lock(tx, ownerUserId, id);
      const settings = hotelSettings(property.contactSettings);
      const publication = validateHotelPublication({
        name: property.name,
        propertyType: property.propertyType,
        city: property.city,
        description: property.description || '',
        metadata: settings.publication || {},
        rooms: property.rooms.map(hotelRoomDraft),
      });
      validateHotelSubmission(publication);
      await tx.hotelProperty.update({
        where: { id },
        data: { status: 'pending_review' },
      });
    });
    return this.owned(ownerUserId, id);
  }

  async photo(
    ownerUserId: string,
    id: string,
    dto: HotelPhotoDto,
    file: UploadedImage,
  ) {
    const prepared = await this.files.prepareListingPhoto(file);
    const photoId = `hp_${digest(`${id}:${dto.uploadId}`)}`;
    let stored: FileAsset | undefined;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerUserId} FOR UPDATE`;
          const property = await this.lock(tx, ownerUserId, id);
          if (
            dto.roomId &&
            !property.rooms.some((room) => room.id === dto.roomId)
          )
            throw new NotFoundException('Chambre introuvable.');
          const existing = await tx.fileAsset.findUnique({
            where: { id: photoId },
          });
          if (existing) {
            if (existing.deletedAt)
              throw new ConflictException('Cette photo a déjà été supprimée.');
            return;
          }
          const assets = await tx.fileAsset.findMany({
            where: {
              ownerUserId,
              module: 'hotels',
              usages: { some: { targetType: 'listing', targetId: id } },
              deletedAt: null,
            },
          });
          const settings = hotelSettings(property.contactSettings);
          const legacy =
            settings.legacyPhotos ||
            (!settings.photoIds?.length && Array.isArray(settings.photos)
              ? settings.photos
              : []);
          const replacement =
            dto.replacePhotoId &&
            assets.find((asset) => asset.id === dto.replacePhotoId);
          const legacyReplacement =
            dto.replacePhotoId &&
            legacy.find(
              (url: string) => `legacy_${digest(url)}` === dto.replacePhotoId,
            );
          if (dto.replacePhotoId && !replacement && !legacyReplacement)
            throw new NotFoundException('Photo à remplacer introuvable.');
          if (
            !dto.replacePhotoId &&
            assets.length + legacy.length >= HOTEL_PHOTO_LIMIT
          )
            throw new BadRequestException('Limite de 30 photos atteinte.');
          const quota = await tx.fileAsset.aggregate({
            where: { ownerUserId, module: 'hotels' },
            _sum: { sizeBytes: true },
          });
          if (
            (quota._sum.sizeBytes || 0) + prepared.size >
            HOTEL_OWNER_PHOTO_QUOTA
          )
            throw new BadRequestException('Quota photo de 150 Mo atteint.');
          stored = await this.files.storeListingPhoto(
            tx,
            ownerUserId,
            id,
            photoId,
            prepared,
            'hotels',
          );
          const photoRoom =
            dto.roomId ||
            (replacement
              ? hotelSettings(replacement.metadata).roomId
              : undefined);
          if (photoRoom)
            await tx.fileAsset.update({
              where: { id: photoId },
              data: { metadata: { roomId: photoRoom } },
            });
          const order = [
            ...new Set<string>([
              ...(settings.photoIds || []),
              ...legacy.map((url: string) => `legacy_${digest(url)}`),
              ...assets.map((asset) => asset.id),
            ]),
          ];
          if (dto.replacePhotoId)
            order.splice(order.indexOf(dto.replacePhotoId), 1, photoId);
          else order.push(photoId);
          if (replacement)
            await tx.fileAsset.update({
              where: { id: replacement.id },
              data: { deletedAt: new Date() },
            });
          await this.persistPhotoOrder(
            tx,
            property,
            order,
            legacy.filter((url: string) => url !== legacyReplacement),
          );
        },
        { timeout: 60000 },
      );
    } catch (error) {
      if (stored) {
        const persisted = await this.prisma.fileAsset
          .findUnique({ where: { id: stored.id } })
          .catch(() => undefined);
        if (
          persisted === null ||
          (persisted && persisted.storageKey !== stored.storageKey)
        )
          await this.files.discardPhotoBinary(stored).catch(() => undefined);
      }
      throw error;
    }
    if (dto.replacePhotoId)
      await this.files.purgeDeletedListingPhoto(
        dto.replacePhotoId,
        ownerUserId,
        'hotels',
      );
    return this.owned(ownerUserId, id);
  }

  private async persistPhotoOrder(
    tx: Prisma.TransactionClient,
    property: any,
    order: string[],
    legacy: string[],
  ) {
    const assets = await tx.fileAsset.findMany({
      where: {
        id: { in: order },
        ownerUserId: property.ownerUserId,
        deletedAt: null,
      },
    });
    const urls = order
      .map((id) =>
        id.startsWith('legacy_')
          ? legacy.find((url) => `legacy_${digest(url)}` === id)
          : assets.find((asset) => asset.id === id)?.publicUrl,
      )
      .filter(Boolean);
    const photoRooms = Object.fromEntries(
      assets
        .filter((asset) => hotelSettings(asset.metadata).roomId)
        .map((asset) => [
          asset.publicUrl!,
          hotelSettings(asset.metadata).roomId,
        ]),
    );
    await tx.hotelProperty.update({
      where: { id: property.id },
      data: {
        status: 'draft',
        contactSettings: {
          ...hotelSettings(property.contactSettings),
          photoIds: order,
          photos: urls,
          legacyPhotos: legacy,
          photoRooms,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async reorder(ownerUserId: string, id: string, order: string[]) {
    const owned = await this.owned(ownerUserId, id);
    if (
      order.length !== owned.photos.length ||
      new Set(order).size !== order.length ||
      order.some((value) => !owned.photos.some((photo) => photo.id === value))
    )
      throw new BadRequestException('Ordre des photos invalide.');
    await this.prisma.$transaction(async (tx) => {
      const property = await this.lock(tx, ownerUserId, id);
      const current = hotelSettings(property.contactSettings).photoIds || [];
      if (
        current.length &&
        (current.length !== order.length ||
          current.some((value: string) => !order.includes(value)))
      )
        throw new ConflictException(
          'Les photos ont changé. Rechargez la page.',
        );
      await this.persistPhotoOrder(
        tx,
        property,
        order,
        owned.photos
          .filter((photo) => !photo.managed)
          .map((photo) => photo.url!),
      );
    });
    return this.owned(ownerUserId, id);
  }

  async removePhoto(ownerUserId: string, id: string, photoId: string) {
    await this.prisma.$transaction(async (tx) => {
      const property = await this.lock(tx, ownerUserId, id);
      const settings = hotelSettings(property.contactSettings);
      const legacy: string[] =
        settings.legacyPhotos ||
        (!settings.photoIds?.length && Array.isArray(settings.photos)
          ? settings.photos
          : []);
      if (photoId.startsWith('legacy_')) {
        if (!legacy.some((url) => `legacy_${digest(url)}` === photoId))
          throw new NotFoundException('Photo introuvable.');
      } else {
        const asset = await tx.fileAsset.findFirst({
          where: {
            id: photoId,
            ownerUserId,
            module: 'hotels',
            deletedAt: null,
            usages: { some: { targetType: 'listing', targetId: id } },
          },
        });
        if (!asset) throw new NotFoundException('Photo introuvable.');
        await tx.fileAsset.update({
          where: { id: photoId },
          data: { deletedAt: new Date() },
        });
      }
      const remaining = legacy.filter(
        (url) => `legacy_${digest(url)}` !== photoId,
      );
      const order = (
        settings.photoIds || legacy.map((url) => `legacy_${digest(url)}`)
      ).filter((value: string) => value !== photoId);
      await this.persistPhotoOrder(tx, property, order, remaining);
    });
    await this.files.purgeDeletedListingPhoto(photoId, ownerUserId, 'hotels');
    return this.owned(ownerUserId, id);
  }
}
