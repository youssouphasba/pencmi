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
import { dirname, extname, join } from 'path';
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
  ) {
    const storageKey = `real-estate/${ownerUserId}/${id}/${randomUUID()}.${file.mimetype.split('/')[1]}`;
    try {
      await this.persistBinary(storageKey, file);
      return await tx.fileAsset.create({
        data: {
          id,
          ownerUserId,
          module: PencmiModule.real_estate,
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
        this.logger.warn(
          `Nettoyage du fichier immobilier à reprendre : ${storageKey}`,
        ),
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

  async purgeDeletedListingPhoto(id: string, ownerUserId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id,
        ownerUserId,
        module: PencmiModule.real_estate,
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
      this.logger.warn(`Nettoyage du fichier immobilier à reprendre : ${id}`);
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
  ) {
    assertUploadStorage(this.config);
    this.validateImage(file);
    const draft = await this.prisma.fileAsset.create({
      data: {
        ownerUserId,
        module: PencmiModule.users,
        visibility: FileVisibility.public,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: `pending/${ownerUserId}/${Date.now()}`,
        metadata: { scope },
      },
    });

    const storageKey = `${scope}/${ownerUserId}/${draft.id}${this.resolveFileExtension(file)}`;

    try {
      await this.persistBinary(storageKey, file);
      const publicUrl = this.buildPublicUrl(draft.id);
      return await this.prisma.fileAsset.update({
        where: { id: draft.id },
        data: {
          storageKey,
          publicUrl,
        },
      });
    } catch (error) {
      await this.prisma.fileAsset
        .delete({ where: { id: draft.id } })
        .catch(() => undefined);
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

    if (asset.module === PencmiModule.real_estate) {
      const usage = await this.prisma.fileUsage.findFirst({
        where: { fileId: id, targetType: TargetType.listing },
      });
      const listing =
        usage &&
        (await this.prisma.realEstateListing.findFirst({
          where: {
            id: usage.targetId,
            status: ListingStatus.active,
            deletedAt: null,
          },
          select: { id: true },
        }));
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

    if (asset.module === PencmiModule.real_estate) {
      throw new BadRequestException('Gérez cette photo depuis son annonce.');
    }

    await this.deleteBinary(asset).catch(() => undefined);
    await this.prisma.fileAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  async softDeleteByPublicUrl(ownerUserId: string, publicUrl?: string | null) {
    const fileId = this.extractFileId(publicUrl);
    if (!fileId) {
      return { deleted: false };
    }
    return this.softDelete(fileId, ownerUserId);
  }

  private validateImage(file?: UploadedImage): asserts file is UploadedImage {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier image n’a été envoyé.');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException(
        'L’image dépasse la taille maximale autorisée de 5 Mo.',
      );
    }
  }

  private resolveFileExtension(file: UploadedImage) {
    const directExtension = extname(file.originalname || '').toLowerCase();
    if (directExtension) {
      return directExtension;
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };

    return mimeToExt[file.mimetype] ?? '.bin';
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
