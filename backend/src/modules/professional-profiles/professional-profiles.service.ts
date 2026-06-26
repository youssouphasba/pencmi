import { Injectable } from '@nestjs/common';
import { ProfessionalType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { UpsertProfessionalProfileDto } from './professional-profiles.dto';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class ProfessionalProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  findMine(userId: string) {
    return this.prisma.professionalProfile.findUnique({ where: { userId } });
  }

  upsertMine(userId: string, dto: UpsertProfessionalProfileDto) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      create: {
        ...dto,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
        professionalType: dto.professionalType as ProfessionalType,
        userId,
      },
      update: {
        ...dto,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : null,
        professionalType: dto.professionalType as ProfessionalType,
      },
    });
  }

  async uploadLogo(userId: string, file: UploadedImage) {
    const current = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { logoUrl: true },
    });
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });
    const asset = await this.filesService.uploadPublicImage(userId, file, 'logo');
    const fallbackBusinessName =
      [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
      owner.email ||
      owner.phone ||
      userId;
    const profile = await this.prisma.professionalProfile.upsert({
      where: { userId },
      create: {
        userId,
        businessName: fallbackBusinessName,
        professionalType: ProfessionalType.other,
        logoUrl: asset.publicUrl,
      },
      update: {
        logoUrl: asset.publicUrl,
      },
    });
    await this.filesService.softDeleteByPublicUrl(userId, current?.logoUrl);
    return profile;
  }

  async removeLogo(userId: string) {
    const current = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { logoUrl: true },
    });
    if (!current) {
      return { removed: false };
    }
    await this.prisma.professionalProfile.update({
      where: { userId },
      data: { logoUrl: null },
    });
    await this.filesService.softDeleteByPublicUrl(userId, current.logoUrl);
    return { removed: true };
  }
}
