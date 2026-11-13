import { ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ContentService } from './content.service';
import { ContentSlugParams, SaveContentPageDto } from './content.dto';

const page = (overrides: any = {}) => ({
  id: 'p', slug: 'conditions', title: 'Ancien', subtitle: null, status: 'active', updatedAt: new Date(),
  sections: [{ position: 1, content: { heading: 'B', body: '2' } }, { position: 0, content: { heading: 'A', body: '1' } }], ...overrides,
});

function setup(existing: any) {
  const tx: any = {
    $queryRaw: jest.fn(),
    contentPage: {
      findUnique: jest.fn(async () => existing),
      update: jest.fn(async () => ({ id: 'p' })),
      create: jest.fn(async () => ({ id: 'p' })),
      findUniqueOrThrow: jest.fn(async () => page({ title: 'Nouveau', sections: [{ position: 0, content: { heading: 'X', body: 'y' } }] })),
    },
    contentVersion: { create: jest.fn(), findMany: jest.fn(async () => [{ id: 'old' }]), deleteMany: jest.fn() },
    contentSection: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
    faqItem: { count: jest.fn(async () => 0), create: jest.fn(async ({ data }: any) => ({ id: 'f', ...data })), updateMany: jest.fn(async () => ({ count: 0 })), deleteMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma: any = { $transaction: jest.fn(async (run: any) => run(tx)), contentPage: { findFirst: jest.fn(async () => existing) } };
  return { tx, service: new ContentService(prisma) };
}

describe('content pages', () => {
  it('keeps the previous state as a version, prunes old ones and audits', async () => {
    const { tx, service } = setup(page());
    const saved = await service.savePage('admin', 'conditions', { title: 'Nouveau', status: 'active', sections: [{ heading: 'X', body: 'y' }] });
    expect(saved).toMatchObject({ title: 'Nouveau', status: 'active', sections: [{ heading: 'X', body: 'y' }] });
    expect(tx.contentVersion.create.mock.calls[0][0].data.snapshot).toMatchObject({ title: 'Ancien', sections: [{ heading: 'A' }, { heading: 'B' }] });
    expect(tx.contentVersion.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old'] } } });
    expect(tx.contentSection.createMany.mock.calls[0][0].data).toEqual([{ pageId: 'p', key: 's0', position: 0, content: { heading: 'X', body: 'y' } }]);
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'content.page_updated' });
  });

  it('serves only published pages, sections in order', async () => {
    expect(await setup(null).service.findPublishedPage('conditions')).toBeNull();
    expect((await setup(page()).service.findPublishedPage('conditions'))?.sections.map((s) => s.heading)).toEqual(['A', 'B']);
  });

  it('accepts only the editable pages and bounded sections', async () => {
    expect(await validate(plainToInstance(ContentSlugParams, { slug: '../admin' }))).not.toHaveLength(0);
    const tooLong = plainToInstance(SaveContentPageDto, { title: 'T', status: 'active', sections: [{ heading: 'H', body: 'x'.repeat(8001) }] });
    expect(await validate(tooLong)).not.toHaveLength(0);
    const html = plainToInstance(SaveContentPageDto, { title: ' T ', status: 'draft', sections: [{ heading: '<b>H</b>', body: 'ok' }] });
    expect(await validate(html)).toHaveLength(0);
    expect(html.title).toBe('T');
  });
});

describe('faq', () => {
  it('creates, refuses unknown ids and caps the number of questions', async () => {
    const { tx, service } = setup(null);
    await expect(service.createFaq('admin', { question: 'Comment ?', answer: 'Ainsi.' })).resolves.toMatchObject({ active: true, position: 0 });
    await expect(service.updateFaq('admin', 'x', { question: 'Comment ?', answer: 'Ainsi.' })).rejects.toThrow(NotFoundException);
    tx.faqItem.count.mockResolvedValueOnce(300);
    await expect(service.createFaq('admin', { question: 'Comment ?', answer: 'Ainsi.' })).rejects.toThrow(ConflictException);
  });
});
