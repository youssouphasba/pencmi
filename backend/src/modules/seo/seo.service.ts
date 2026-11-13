import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SaveSeoMetaDto } from './seo.dto';

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);
const publicFields = { path: true, title: true, description: true, noindex: true } as const;

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  findMeta(path: string) {
    return this.prisma.seoMeta.findUnique({ where: { path: normalize(path) }, select: publicFields });
  }

  list() {
    return this.prisma.seoMeta.findMany({ orderBy: { path: 'asc' } });
  }

  async save(adminId: string, dto: SaveSeoMetaDto) {
    const path = normalize(dto.path);
    return this.prisma.$transaction(async (tx) => {
      const data = { title: dto.title, description: dto.description, noindex: dto.noindex ?? false };
      const meta = await tx.seoMeta.upsert({ where: { path }, update: data, create: { path, ...data } });
      await tx.auditLog.create({
        data: { actorUserId: adminId, module: 'content', targetType: 'other', targetId: meta.id, action: 'seo.meta_saved', metadata: { path, noindex: data.noindex } },
      });
      return meta;
    });
  }

  async remove(adminId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const meta = await tx.seoMeta.findUnique({ where: { id } });
      if (!meta) throw new NotFoundException('Réglage introuvable.');
      await tx.seoMeta.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actorUserId: adminId, module: 'content', targetType: 'other', targetId: id, action: 'seo.meta_deleted', metadata: { path: meta.path } },
      });
      return { id, deleted: true };
    });
  }
}
