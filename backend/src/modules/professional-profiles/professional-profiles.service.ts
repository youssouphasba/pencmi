import { Injectable } from '@nestjs/common';
import { ProfessionalType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpsertProfessionalProfileDto } from './professional-profiles.dto';

@Injectable()
export class ProfessionalProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.professionalProfile.findUnique({ where: { userId } });
  }

  upsertMine(userId: string, dto: UpsertProfessionalProfileDto) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      create: {
        ...dto,
        professionalType: dto.professionalType as ProfessionalType,
        userId,
      },
      update: {
        ...dto,
        professionalType: dto.professionalType as ProfessionalType,
      },
    });
  }
}
