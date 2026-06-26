import { Injectable } from '@nestjs/common';
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

  updateProfile(id: string, dto: UpdateUserProfileDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
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
  }

  async uploadAvatar(id: string, file: UploadedImage) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { avatarUrl: true },
    });
    const asset = await this.filesService.uploadPublicImage(id, file, 'avatar');
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: asset.publicUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
    await this.filesService.softDeleteByPublicUrl(id, current.avatarUrl);
    return user;
  }

  async removeAvatar(id: string) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { avatarUrl: true },
    });
    await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: null },
    });
    await this.filesService.softDeleteByPublicUrl(id, current.avatarUrl);
    return { removed: true };
  }
}
