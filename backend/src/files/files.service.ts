import { Injectable } from '@nestjs/common';
import { FileVisibility, PencmiModule } from '@prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

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

  softDelete(id: string, ownerUserId: string) {
    return this.prisma.fileAsset.updateMany({
      where: { id, ownerUserId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
