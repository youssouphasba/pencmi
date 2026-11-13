import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CONTENT_PAGE_SLUGS, CONTENT_VERSIONS_KEPT, ContentPageSlug, MAX_FAQ_ITEMS } from './content.constants';
import { SaveContentPageDto, SaveFaqItemDto } from './content.dto';

type Section = { heading: string; body: string };
type PageWithSections = Prisma.ContentPageGetPayload<{ include: { sections: true } }>;

function pageView(page: PageWithSections) {
  return {
    slug: page.slug,
    title: page.title,
    subtitle: page.subtitle,
    status: page.status === ListingStatus.active ? 'active' : 'draft',
    updatedAt: page.updatedAt,
    sections: [...page.sections]
      .sort((a, b) => a.position - b.position)
      .map((section) => section.content as Section),
  };
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublishedPage(slug: ContentPageSlug) {
    const page = await this.prisma.contentPage.findFirst({
      where: { slug, status: ListingStatus.active },
      include: { sections: true },
    });
    return page ? pageView(page) : null;
  }

  findFaq() {
    return this.prisma.faqItem.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, question: true, answer: true, category: true, module: true },
    });
  }

  async adminPages() {
    const pages = await this.prisma.contentPage.findMany({
      where: { slug: { in: [...CONTENT_PAGE_SLUGS] } },
      select: { slug: true, title: true, status: true, updatedAt: true, _count: { select: { versions: true } } },
    });
    return CONTENT_PAGE_SLUGS.map((slug) => {
      const page = pages.find((item) => item.slug === slug);
      return {
        slug,
        saved: Boolean(page),
        title: page?.title ?? null,
        status: page ? (page.status === ListingStatus.active ? 'active' : 'draft') : null,
        updatedAt: page?.updatedAt ?? null,
        versions: page?._count.versions ?? 0,
      };
    });
  }

  async adminPage(slug: ContentPageSlug) {
    const page = await this.prisma.contentPage.findUnique({ where: { slug }, include: { sections: true } });
    if (!page) return null;
    const versions = await this.prisma.contentVersion.findMany({
      where: { pageId: page.id },
      orderBy: { createdAt: 'desc' },
      take: CONTENT_VERSIONS_KEPT,
      select: { id: true, createdAt: true, createdBy: true, snapshot: true },
    });
    return {
      ...pageView(page),
      versions: versions.map((version) => ({
        id: version.id,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        title: (version.snapshot as { title?: string })?.title ?? '',
        status: (version.snapshot as { status?: string })?.status ?? '',
      })),
    };
  }

  /** Saves the page and keeps the previous state as a version, so that a mistake can be undone. */
  async savePage(adminId: string, slug: ContentPageSlug, dto: SaveContentPageDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'content:' + slug}))`;
      const existing = await tx.contentPage.findUnique({ where: { slug }, include: { sections: true } });
      const status = dto.status === 'active' ? ListingStatus.active : ListingStatus.draft;
      const data = { title: dto.title, subtitle: dto.subtitle || null, status, updatedByUserId: adminId };
      const page = existing
        ? await tx.contentPage.update({ where: { slug }, data })
        : await tx.contentPage.create({ data: { slug, ...data } });
      if (existing) {
        await tx.contentVersion.create({
          data: { pageId: existing.id, createdBy: adminId, snapshot: pageView(existing) as unknown as Prisma.InputJsonValue },
        });
        const old = await tx.contentVersion.findMany({
          where: { pageId: existing.id },
          orderBy: { createdAt: 'desc' },
          skip: CONTENT_VERSIONS_KEPT,
          select: { id: true },
        });
        if (old.length) await tx.contentVersion.deleteMany({ where: { id: { in: old.map((version) => version.id) } } });
        await tx.contentSection.deleteMany({ where: { pageId: existing.id } });
      }
      await tx.contentSection.createMany({
        data: dto.sections.map((section, position) => ({
          pageId: page.id,
          key: `s${position}`,
          position,
          content: { heading: section.heading, body: section.body },
        })),
      });
      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          module: 'content',
          targetType: 'other',
          targetId: page.id,
          action: existing ? 'content.page_updated' : 'content.page_created',
          metadata: { slug, status: dto.status, sections: dto.sections.length },
        },
      });
      return pageView(await tx.contentPage.findUniqueOrThrow({ where: { slug }, include: { sections: true } }));
    });
  }

  async versionSnapshot(slug: ContentPageSlug, versionId: string) {
    const version = await this.prisma.contentVersion.findFirst({ where: { id: versionId, page: { slug } } });
    if (!version) throw new NotFoundException('Version introuvable.');
    return version.snapshot;
  }

  adminFaq() {
    return this.prisma.faqItem.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  async createFaq(adminId: string, dto: SaveFaqItemDto) {
    return this.prisma.$transaction(async (tx) => {
      if ((await tx.faqItem.count()) >= MAX_FAQ_ITEMS) throw new ConflictException(`${MAX_FAQ_ITEMS} questions au maximum.`);
      const item = await tx.faqItem.create({ data: this.faqData(dto) });
      await this.auditFaq(tx, adminId, item.id, 'content.faq_created');
      return item;
    });
  }

  async updateFaq(adminId: string, id: string, dto: SaveFaqItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.faqItem.updateMany({ where: { id }, data: this.faqData(dto) });
      if (!changed.count) throw new NotFoundException('Question introuvable.');
      await this.auditFaq(tx, adminId, id, 'content.faq_updated');
      return tx.faqItem.findUniqueOrThrow({ where: { id } });
    });
  }

  async deleteFaq(adminId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.faqItem.deleteMany({ where: { id } });
      if (!removed.count) throw new NotFoundException('Question introuvable.');
      await this.auditFaq(tx, adminId, id, 'content.faq_deleted');
      return { id, deleted: true };
    });
  }

  private faqData(dto: SaveFaqItemDto) {
    return {
      question: dto.question,
      answer: dto.answer,
      category: dto.category ?? null,
      active: dto.active ?? true,
      position: dto.position ?? 0,
    };
  }

  private auditFaq(tx: Prisma.TransactionClient, adminId: string, id: string, action: string) {
    return tx.auditLog.create({ data: { actorUserId: adminId, module: 'content', targetType: 'other', targetId: id, action } });
  }
}
