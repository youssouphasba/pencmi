import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  findMeta(path: string) {
    return this.prisma.seoMeta.findUnique({ where: { path } });
  }
}
