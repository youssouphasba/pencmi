import { Injectable } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpsertContentPageDto } from './content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  findPublishedPage(slug: string) {
    return this.prisma.contentPage.findFirst({
      where: { slug, status: ListingStatus.active },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
  }

  findFaq() {
    return this.prisma.faqItem.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPage(dto: UpsertContentPageDto) {
    return this.prisma.contentPage.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        sections: {
          create: dto.sections?.map((section) => ({
            key: section.key,
            content: section.content as Prisma.InputJsonValue,
            position: section.position ?? 0,
          })),
        },
      },
      include: { sections: true },
    });
  }

  async updatePage(slug: string, dto: UpsertContentPageDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.contentPage.findUniqueOrThrow({ where: { slug }, include: { sections: true } });
      await tx.contentVersion.create({
        data: {
          pageId: existing.id,
          snapshot: existing,
        },
      });
      await tx.contentSection.deleteMany({ where: { pageId: existing.id } });
      return tx.contentPage.update({
        where: { slug },
        data: {
          title: dto.title,
          sections: {
            create: dto.sections?.map((section) => ({
              key: section.key,
              content: section.content as Prisma.InputJsonValue,
              position: section.position ?? 0,
            })),
          },
        },
        include: { sections: true },
      });
    });
  }
}
