import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileAsset, FileVisibility, PencmiModule } from '@prisma/client';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { PrismaService } from '../database/prisma/prisma.service';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  createUploadPlaceholder(ownerUserId: string) {
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

  findOwned(id: string, ownerUserId: string) {
    return this.prisma.fileAsset.findFirstOrThrow({
      where: { id, ownerUserId, deletedAt: null },
    });
  }

  async uploadPublicImage(ownerUserId: string, file: UploadedImage, scope: 'avatar' | 'logo') {
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
      await this.prisma.fileAsset.delete({ where: { id: draft.id } }).catch(() => undefined);
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
      throw new BadRequestException('L’image dépasse la taille maximale autorisée de 5 Mo.');
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
    const apiPrefix = (this.config.get<string>('API_PREFIX') ?? 'api/v1').replace(/^\/+|\/+$/g, '');
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
    if (this.getStorageDriver() === 'local') {
      const targetPath = join(process.cwd(), 'uploads', storageKey);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.buffer);
      return;
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!client || !bucket) {
      throw new InternalServerErrorException('Le stockage de fichiers n’est pas configuré.');
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  }

  private async readBinary(asset: FileAsset) {
    if (this.getStorageDriver() === 'local') {
      return readFile(join(process.cwd(), 'uploads', asset.storageKey));
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!client || !bucket) {
      throw new InternalServerErrorException('Le stockage de fichiers n’est pas configuré.');
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
      const targetPath = join(process.cwd(), 'uploads', asset.storageKey);
      await unlink(targetPath).catch(() => undefined);
      return;
    }

    const client = this.getS3Client();
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!client || !bucket) {
      return;
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: asset.storageKey,
      }),
    );
  }

  private getStorageDriver() {
    const driver = this.config.get<string>('STORAGE_DRIVER');
    return driver === 'r2' || driver === 's3' ? driver : 'local';
  }

  private getS3Client() {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      return null;
    }

    return new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
}
