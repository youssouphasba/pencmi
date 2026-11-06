import { Injectable, Logger } from '@nestjs/common';
import { FileAsset } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { UpdateUserProfileDto } from './users.dto';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        avatarUrl: true,
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        professionalVerified: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto) {
    await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        city: dto.city,
      },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        avatarUrl: true,
      },
    });
    return this.findById(id);
  }

  async uploadAvatar(id: string, file: UploadedImage) {
    let asset: FileAsset | undefined;
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
          const current = await tx.user.findUniqueOrThrow({
            where: { id },
            select: { avatarUrl: true },
          });
          asset = await this.filesService.uploadPublicImage(
            id,
            file,
            'avatar',
            tx,
          );
          const user = await tx.user.update({
            where: { id },
            data: { avatarUrl: asset.publicUrl },
            select: { id: true, avatarUrl: true },
          });
          return { user, previous: current.avatarUrl };
        },
        { maxWait: 10000, timeout: 30000 },
      );
      await this.filesService
        .softDeleteByPublicUrl(id, result.previous, 'avatar')
        .catch(() =>
          this.logger.warn('Nettoyage de l’ancien avatar à reprendre.'),
        );
      return result.user;
    } catch (error) {
      if (asset)
        await this.filesService
          .discardPhotoBinary(asset)
          .catch(() =>
            this.logger.warn(
              'Nettoyage d’un téléversement interrompu à reprendre.',
            ),
          );
      throw error;
    }
  }

  async removeAvatar(id: string) {
    const current = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
      const row = await tx.user.findUniqueOrThrow({
        where: { id },
        select: { avatarUrl: true },
      });
      await tx.user.update({ where: { id }, data: { avatarUrl: null } });
      return row;
    });
    await this.filesService
      .softDeleteByPublicUrl(id, current.avatarUrl, 'avatar')
      .catch(() =>
        this.logger.warn('Nettoyage de l’ancien avatar à reprendre.'),
      );
    return { removed: true };
  }
}
