import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class GeoService {
  constructor(private readonly prisma: PrismaService) {}

  findPublicEntities() {
    return this.prisma.geoEntity.findMany({
      where: { public: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
