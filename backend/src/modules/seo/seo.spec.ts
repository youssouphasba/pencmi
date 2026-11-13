import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveSeoMetaDto, SeoPathQuery } from './seo.dto';
import { SeoService } from './seo.service';

const valid = { path: '/hotels/', title: 'Hôtels au Sénégal - Péncmi', description: 'Comparez les hôtels, auberges et résidences au Sénégal et envoyez votre demande de réservation.' };

describe('seo overrides', () => {
  it('accepts public paths only, with bounded title and description', async () => {
    expect(await validate(plainToInstance(SaveSeoMetaDto, valid))).toHaveLength(0);
    for (const path of ['/admin', '/admin/users', '/dashboard/hotels', '/compte', '/api/v1', 'hotels', '/<script>', '//evil.com'])
      expect(await validate(plainToInstance(SeoPathQuery, { path }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(SaveSeoMetaDto, { ...valid, title: 'court' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(SaveSeoMetaDto, { ...valid, description: 'x'.repeat(171) }))).not.toHaveLength(0);
  });

  it('stores one override per path without trailing slash, audited', async () => {
    const tx: any = { seoMeta: { upsert: jest.fn(async ({ create }: any) => ({ id: 'm', ...create })) }, auditLog: { create: jest.fn() } };
    const prisma: any = { $transaction: jest.fn(async (run: any) => run(tx)), seoMeta: { findUnique: jest.fn() } };
    const service = new SeoService(prisma);
    await service.save('admin', { ...valid, noindex: true });
    expect(tx.seoMeta.upsert.mock.calls[0][0].where).toEqual({ path: '/hotels' });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'seo.meta_saved', metadata: { path: '/hotels', noindex: true } });
    await service.findMeta('/hotels/');
    expect(prisma.seoMeta.findUnique.mock.calls[0][0].where).toEqual({ path: '/hotels' });
  });
});
