import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileAsset,
  FileVisibility,
  ListingStatus,
  PencmiModule,
  Prisma,
  TargetType,
} from '@prisma/client';
import type SharpFactory from 'sharp';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import { MAX_PHOTO_BYTES, MAX_PHOTO_PIXELS } from './listing-photo.constants';
import {
  assertUploadStorage,
  remoteStorageConfig,
  storageDriver,
} from './storage.config';

const sharp: typeof SharpFactory = require('sharp');

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async prepareListingPhoto(file: UploadedImage) {
    assertUploadStorage(this.config);
    if (!file?.buffer?.length || file.buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Choisissez une photo de 5 Mo maximum.');
    }
    try {
      const bytes = file.buffer;
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!jpeg && !png && !webp) throw new Error('format');
      const image = sharp(bytes, {
        limitInputPixels: MAX_PHOTO_PIXELS,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      const mimeTypes: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      if (
        !metadata.format ||
        !mimeTypes[metadata.format] ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error('format');
      const buffer = await image
        .rotate()
        .toFormat(metadata.format as 'jpeg' | 'png' | 'webp')
        .toBuffer();
      if (buffer.length > MAX_PHOTO_BYTES) throw new Error('size');
      return {
        buffer,
        size: buffer.length,
        mimetype: mimeTypes[metadata.format],
        originalname: `photo.${metadata.format}`,
      };
    } catch {
      throw new BadRequestException(
        'Photo invalide. Formats acceptés : JPEG, PNG et WebP, sans animation.',
      );
    }
  }

  async storeListingPhoto(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    listingId: string,
    id: string,
    file: UploadedImage,
    module: 'real_estate' | 'hotels' | 'vehicles' = 'real_estate',
  ) {
    const storageKey = `${module === 'real_estate' ? 'real-estate' : module}/${ownerUserId}/${id}/${randomUUID()}.${file.mimetype.split('/')[1]}`;
    try {
      await this.persistBinary(storageKey, file);
      return await tx.fileAsset.create({
        data: {
          id,
          ownerUserId,
          module,
          visibility: FileVisibility.public,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          publicUrl: this.buildPublicUrl(id),
          usages: {
            create: { targetType: TargetType.listing, targetId: listingId },
          },
        },
      });
    } catch (error) {
      await this.deleteBinary({ storageKey } as FileAsset).catch(() =>
        this.logger.warn(`Nettoyage du fichier à reprendre : ${storageKey}`),
      );
      throw error;
    }
  }

  async discardPhotoBinary(asset: FileAsset) {
    await this.deleteBinary(asset);
  }

  async streamOwnedContent(id: string, ownerUserId: string) {
    const asset = await this.findOwned(id, ownerUserId);
    return { asset, buffer: await this.readBinary(asset) };
  }

  async purgeDeletedListingPhoto(
    id: string,
    ownerUserId: string,
    module: 'real_estate' | 'hotels' | 'vehicles' = 'real_estate',
  ) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id,
        ownerUserId,
        module,
        deletedAt: { not: null },
      },
    });
    if (!asset) return;
    try {
      await this.deleteBinary(asset);
      await this.prisma.fileAsset.update({
        where: { id },
        data: { sizeBytes: 0 },
      });
    } catch {
      this.logger.warn(`Nettoyage du fichier à reprendre : ${id}`);
    }
  }

  createUploadPlaceholder(ownerUserId: string) {
    assertUploadStorage(this.config);
    return this.prisma.fileAsset.create({
      data: {
        ownerUserId,
        module: PencmiModule.system,
        visibility: FileVisibility.private,
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        storageKey: `pending/${ownerUserId}/${Date.now()}`,
      },
    });
  }

  async findOwned(id: string, ownerUserId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: { id, ownerUserId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Fichier introuvable.');
    return asset;
  }

  async uploadPublicImage(
    ownerUserId: string,
    file: UploadedImage,
    scope: 'avatar' | 'logo',
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const prepared = await this.prepareListingPhoto(file);
    const buffer = await sharp(prepared.buffer, { limitInputPixels: MAX_PHOTO_PIXELS, failOn: 'warning' })
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const normalized = { buffer, size: buffer.length, mimetype: 'image/webp', originalname: 'image.webp' };
    const id = randomUUID();
    const storageKey = `${scope}/${ownerUserId}/${id}.webp`;
    try {
      await this.persistBinary(storageKey, normalized);
      return await tx.fileAsset.create({
        data: {
          id, ownerUserId, module: PencmiModule.users, visibility: FileVisibility.public,
          mimeType: normalized.mimetype, sizeBytes: normalized.size, storageKey,
          publicUrl: this.buildPublicUrl(id), metadata: { scope },
        },
      });
    } catch (error) {
      await this.deleteBinary({ storageKey } as FileAsset).catch(() => this.logger.warn('Nettoyage d’une image interrompue à reprendre.'));
      throw error;
    }
  }

  async streamPublicContent(id: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: { id, visibility: FileVisibility.public, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException('Fichier introuvable.');
    }

    if (asset.module === PencmiModule.users && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType))
      throw new NotFoundException('Fichier introuvable.');

    if (
      asset.module === PencmiModule.real_estate ||
      asset.module === PencmiModule.hotels ||
      asset.module === PencmiModule.vehicles
    ) {
      const usage = await this.prisma.fileUsage.findFirst({
        where: { fileId: id, targetType: TargetType.listing },
      });
      const listing =
        usage &&
        (await (asset.module === PencmiModule.vehicles
          ? this.prisma.vehicleListing.findFirst({
              where: {
                id: usage.targetId,
                status: ListingStatus.active,
                deletedAt: null,
              },
              select: { id: true },
            })
          : asset.module === PencmiModule.hotels
            ? this.prisma.hotelProperty.findFirst({
                where: {
                  id: usage.targetId,
                  status: ListingStatus.active,
                  deletedAt: null,
                },
                select: { id: true },
              })
            : this.prisma.realEstateListing.findFirst({
                where: {
                  id: usage.targetId,
                  status: ListingStatus.active,
                  deletedAt: null,
                },
                select: { id: true },
              })));
      if (!listing) throw new NotFoundException('Fichier introuvable.');
    }

    const buffer = await this.readBinary(asset);
    return {
      asset,
      buffer,
    };
  }

  async softDelete(id: string, ownerUserId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: { id, ownerUserId, deletedAt: null },
    });

    if (!asset) {
      throw new NotFoundException('Fichier introuvable.');
    }
    if (asset.module === PencmiModule.users)
      throw new BadRequestException('Gérez cette image depuis son profil.');

    if (
      asset.module === PencmiModule.real_estate ||
      asset.module === PencmiModule.hotels ||
      asset.module === PencmiModule.vehicles
    ) {
      throw new BadRequestException('Gérez cette photo depuis son annonce.');
    }

    await this.deleteBinary(asset).catch(() => undefined);
    await this.prisma.fileAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async softDeleteByPublicUrl(ownerUserId: string, publicUrl?: string | null, scope?: 'avatar' | 'logo') {
    const fileId = this.extractFileId(publicUrl);
    if (!fileId) {
      return { deleted: false };
    }
    const asset = await this.prisma.fileAsset.findFirst({ where: { id: fileId, ownerUserId, publicUrl, module: PencmiModule.users, deletedAt: null } });
    const assetScope = (asset?.metadata as { scope?: string } | null)?.scope;
    if (!asset || !['avatar', 'logo'].includes(assetScope || '') || (scope && assetScope !== scope)) return { deleted: false };
    const references = await Promise.all([
      this.prisma.user.count({ where: { avatarUrl: publicUrl } }),
      this.prisma.professionalProfile.count({ where: { logoUrl: publicUrl } }),
      this.prisma.fileUsage.count({ where: { fileId } }),
    ]);
    if (references.some(Boolean)) return { deleted: false };
    await this.prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
    try {
      await this.deleteBinary(asset);
      await this.prisma.fileAsset.update({ where: { id: fileId }, data: { sizeBytes: 0 } });
    } catch { this.logger.warn('Nettoyage d’une ancienne image à reprendre.'); }
    return { deleted: true };
  }

  private buildPublicUrl(fileId: string) {
    const baseUrl = this.config.get<string>('BACKEND_URL')?.replace(/\/+$/, '');
    const apiPrefix = (
      this.config.get<string>('API_PREFIX') ?? 'api/v1'
    ).replace(/^\/+|\/+$/g, '');
    const path = `/${apiPrefix}/files/public/${fileId}`;
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  private extractFileId(publicUrl?: string | null) {
    if (!publicUrl) {
      return null;
    }
    const match = publicUrl.match(/\/files\/public\/([^/?#]+)/);
    return match?.[1] ?? null;
  }

  private async persistBinary(storageKey: string, file: UploadedImage) {
    assertUploadStorage(this.config);
    if (this.getStorageDriver() === 'local') {
      const targetPath = join(this.localDirectory(), storageKey);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.buffer);
      return;
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET')?.trim();
    if (!client || !bucket) {
      throw new InternalServerErrorException(
        'Le stockage de fichiers n’est pas configuré.',
      );
    }

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch {
      this.logger.warn('Échec du téléversement vers le stockage distant.');
      throw new ServiceUnavailableException(
        'Le stockage distant est indisponible ou sa configuration est invalide. Réessayez après vérification du service.',
      );
    }
  }

  private async readBinary(asset: FileAsset) {
    if (this.getStorageDriver() === 'local') {
      return readFile(join(this.localDirectory(), asset.storageKey));
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET')?.trim();
    if (!client || !bucket) {
      throw new InternalServerErrorException(
        'Le stockage de fichiers n’est pas configuré.',
      );
    }

    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: asset.storageKey,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new NotFoundException('Fichier introuvable.');
    }

    return Buffer.from(bytes);
  }

  private async deleteBinary(asset: FileAsset) {
    if (this.getStorageDriver() === 'local') {
      const targetPath = join(this.localDirectory(), asset.storageKey);
      await unlink(targetPath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      return;
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET')?.trim();
    if (!client || !bucket) {
      throw new InternalServerErrorException(
        'Le stockage de fichiers n’est pas configuré.',
      );
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: asset.storageKey,
      }),
    );
  }

  private getStorageDriver() {
    return storageDriver(this.config);
  }

  private localDirectory() {
    return (
      this.config.get<string>('LOCAL_UPLOAD_DIRECTORY') ||
      join(process.cwd(), 'uploads')
    );
  }

  private getS3Client() {
    const driver = this.getStorageDriver();
    if (driver === 'local') return null;
    const { region, endpoint, credentials } = remoteStorageConfig(
      this.config,
      driver,
    );
    return new S3Client({
      region,
      endpoint,
      credentials,
      forcePathStyle: false,
    });
  }
}
