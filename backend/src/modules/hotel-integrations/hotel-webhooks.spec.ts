import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { queueHotelChannelEvent } from '../hotels/hotel-channel-events';
import { HotelChannelPartnersService } from './hotel-channel-partners';
import { HotelSyncService } from './hotel-sync.service';
import {
  HotelWebhookService,
  openWebhookSecret,
  parseWebhookUrl,
  sealWebhookSecret,
  signWebhook,
  WEBHOOK_RETRY_DELAYS_MS,
} from './hotel-webhooks';

const KEY = 'ab'.repeat(32);
const key = Buffer.from(KEY, 'hex');
const secret = `whsec_${'c'.repeat(64)}`;

describe('webhook secrets and signatures', () => {
  it('opens a sealed secret only for its partner', () => {
    const sealed = sealWebhookSecret(secret, key, 'p1');
    expect(sealed).not.toContain(secret);
    expect(openWebhookSecret(sealed, key, 'p1')).toBe(secret);
    expect(() => openWebhookSecret(sealed, key, 'p2')).toThrow();
    expect(() => openWebhookSecret(sealed, Buffer.alloc(32), 'p1')).toThrow();
  });

  it('signs the timestamp and the exact body', () => {
    const body = '{"id":"d"}';
    const expected = createHmac('sha256', secret).update(`1700000000.${body}`).digest('hex');
    expect(signWebhook(secret, 1700000000, body)).toBe(`v1=${expected}`);
    expect(signWebhook(secret, 1700000001, body)).not.toBe(`v1=${expected}`);
  });

  it('accepts only https links to a public host', () => {
    expect(parseWebhookUrl('https://hooks.example.com/pencmi').host).toBe('hooks.example.com');
    for (const url of [
      'http://hooks.example.com/pencmi',
      'https://127.0.0.1/hook',
      'https://10.0.0.5/hook',
      'https://localhost/hook',
      'https://user:pass@hooks.example.com/hook',
      'https://hooks.example.com:8443/hook',
      'not a url',
    ])
      expect(() => parseWebhookUrl(url)).toThrow(BadRequestException);
  });
});

describe('webhook queue', () => {
  const integration = { id: 'i', status: 'active', syncMode: 'channel_manager', channelPartnerId: 'p', hotelCode: 'PCM1' };
  const tx = (partner: any) =>
    ({
      hotelChannelEvent: {
        findUnique: jest.fn(async () => null),
        deleteMany: jest.fn(async () => ({ count: 0 })),
        upsert: jest.fn(async () => ({ id: 'event' })),
      },
      hotelChannelPartner: { findFirst: jest.fn(async () => partner) },
      hotelChannelWebhookDelivery: { createMany: jest.fn(async () => ({ count: 1 })) },
    }) as any;

  it('announces each reservation event to a partner with a webhook', async () => {
    const client = tx({ id: 'p' });
    await queueHotelChannelEvent(client, integration, 'r', 'commit');
    expect(client.hotelChannelWebhookDelivery.createMany).toHaveBeenCalledWith({
      data: [{ partnerId: 'p', channelEventId: 'event', type: 'reservation.commit', hotelCode: 'PCM1' }],
      skipDuplicates: true,
    });
  });

  it('queues no notification without a webhook', async () => {
    const client = tx(null);
    await queueHotelChannelEvent(client, integration, 'r', 'commit');
    expect(client.hotelChannelEvent.upsert).toHaveBeenCalled();
    expect(client.hotelChannelWebhookDelivery.createMany).not.toHaveBeenCalled();
  });
});

describe('webhook delivery', () => {
  const previous = process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY;
  beforeEach(() => (process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY = KEY));
  afterAll(() => (process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY = previous));

  const delivery = (overrides: any = {}) => ({
    id: 'd',
    type: 'reservation.commit',
    hotelCode: 'PCM1',
    channelEventId: 'event',
    attempts: 0,
    createdAt: new Date('2030-06-01T00:00:00Z'),
    partner: { id: 'p', active: true, webhookUrl: 'https://hooks.example.com/pencmi', webhookSecret: sealWebhookSecret(secret, key, 'p') },
    channelEvent: { requestId: 'r', ackedAt: null },
    ...overrides,
  });
  const setup = (row: any, response: any = { status: 200 }) => {
    const prisma: any = {
      $queryRaw: jest.fn(async () => [{ id: 'd' }]),
      hotelChannelWebhookDelivery: {
        findUnique: jest.fn(async () => row),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };
    const service = new HotelWebhookService(prisma);
    service.sender = jest.fn(async () => response);
    const update = () => prisma.hotelChannelWebhookDelivery.updateMany.mock.calls[0]?.[0];
    return { prisma, service, update };
  };

  it('posts a signed notification without client data', async () => {
    const { service, update } = setup(delivery());
    await expect(service.deliverDue()).resolves.toBe(1);
    const [url, body, headers] = (service.sender as jest.Mock).mock.calls[0];
    expect(url.toString()).toBe('https://hooks.example.com/pencmi');
    expect(JSON.parse(body)).toEqual({
      id: 'd',
      type: 'reservation.commit',
      createdAt: '2030-06-01T00:00:00.000Z',
      data: { hotelCode: 'PCM1', eventId: 'event', reservationId: 'r' },
    });
    expect(headers['x-pencmi-signature']).toBe(signWebhook(secret, Number(headers['x-pencmi-timestamp']), body));
    expect(headers).toMatchObject({ 'x-pencmi-event-id': 'd', 'x-pencmi-attempt': '1' });
    expect(update()).toEqual({
      where: { id: 'd', status: 'sending' },
      data: expect.objectContaining({ status: 'sent', attempts: 1, lastStatus: 200 }),
    });
  });

  it('retries after a failure, then gives up', async () => {
    const first = setup(delivery(), { status: 503 });
    const before = Date.now();
    await first.service.deliverDue();
    const data = first.update().data;
    expect(data).toMatchObject({ status: 'retrying', attempts: 1, lastStatus: 503, lastError: 'Réponse HTTP 503.' });
    expect(data.nextAttemptAt.valueOf()).toBeGreaterThanOrEqual(before + WEBHOOK_RETRY_DELAYS_MS[0]);

    const last = setup(delivery({ attempts: WEBHOOK_RETRY_DELAYS_MS.length }), { status: 0, error: 'Destinataire injoignable.' });
    await last.service.deliverDue();
    expect(last.update().data).toMatchObject({ status: 'failed', lastStatus: null, lastError: 'Destinataire injoignable.' });
  });

  it('skips events already acknowledged and removed webhooks', async () => {
    const acked = setup(delivery({ channelEvent: { requestId: 'r', ackedAt: new Date() } }));
    await acked.service.deliverDue();
    expect(acked.update().data).toMatchObject({ status: 'skipped' });
    const removed = setup(delivery({ partner: { id: 'p', active: true, webhookUrl: null, webhookSecret: null } }));
    await removed.service.deliverDue();
    expect(removed.update().data).toMatchObject({ status: 'skipped' });
    expect(acked.service.sender).not.toHaveBeenCalled();
    expect(removed.service.sender).not.toHaveBeenCalled();
  });

  it('waits for the server key without spending an attempt', async () => {
    delete process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY;
    const { service, update } = setup(delivery());
    await service.deliverDue();
    expect(service.sender).not.toHaveBeenCalled();
    expect(update().data).toMatchObject({ status: 'retrying' });
    expect(update().data.attempts).toBeUndefined();
  });
});

describe('webhook registration by an admin', () => {
  const previous = process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY;
  afterAll(() => (process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY = previous));
  const prisma = () => {
    const tx: any = {
      hotelChannelPartner: { update: jest.fn(async ({ data }: any) => ({ id: 'p', _count: { integrations: 0 }, ...data })) },
      auditLog: { create: jest.fn() },
    };
    return {
      tx,
      client: {
        hotelChannelPartner: { findUnique: jest.fn(async () => ({ id: 'p' })) },
        $transaction: jest.fn(async (run: any) => run(tx)),
      } as any,
    };
  };

  it('refuses without a server key, then returns the secret once', async () => {
    delete process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY;
    const { client, tx } = prisma();
    const service = new HotelChannelPartnersService(client);
    await expect(service.setWebhook('admin', 'p', { url: 'https://hooks.example.com/x' })).rejects.toThrow(ServiceUnavailableException);
    await expect(service.setWebhook('admin', 'p', { url: 'http://hooks.example.com/x' })).rejects.toThrow(BadRequestException);

    process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY = KEY;
    const result = await service.setWebhook('admin', 'p', { url: 'https://hooks.example.com/x' });
    expect(result.webhookSecret).toMatch(/^whsec_[a-f0-9]{64}$/);
    const stored = tx.hotelChannelPartner.update.mock.calls[0][0].data;
    expect(stored.webhookUrl).toBe('https://hooks.example.com/x');
    expect(openWebhookSecret(stored.webhookSecret, key, 'p')).toBe(result.webhookSecret);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'hotel_channel_partner.webhook_set', metadata: { host: 'hooks.example.com' } }),
    });
  });
});

describe('channel manager restrictions', () => {
  const integration = {
    id: 'i', propertyId: 'h', status: 'active', syncMode: 'channel_manager', channelPartnerId: 'p',
    property: { id: 'h', deletedAt: null },
  };
  const start = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const setup = () => {
    const tx: any = {
      hotelRoomAvailability: { createMany: jest.fn(), updateMany: jest.fn() },
      hotelRoomRate: { createMany: jest.fn(), updateMany: jest.fn() },
      hotelRestriction: { createMany: jest.fn(), updateMany: jest.fn() },
      hotelIntegration: { update: jest.fn() },
    };
    const prisma: any = {
      hotelIntegration: { findUnique: jest.fn(async () => integration) },
      hotelRoom: { findMany: jest.fn(async () => [{ id: 'room' }]) },
      $transaction: jest.fn(async (run: any) => run(tx)),
    };
    return { tx, service: new HotelSyncService(prisma) };
  };

  it('writes stop sell and stay limits for each night, without touching stock or prices', async () => {
    const { tx, service } = setup();
    await expect(
      service.channelInventory({ id: 'p', code: 'acme' }, 'PCM1', {
        items: [{ roomCode: 'room', start, end, stopSell: true, minStay: 2, maxStay: null }],
      }),
    ).resolves.toMatchObject({ days: 2 });
    expect(tx.hotelRestriction.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.hotelRestriction.updateMany).toHaveBeenCalledWith({
      where: { roomId: 'room', date: { gte: new Date(`${start}T00:00:00Z`), lte: new Date(`${end}T00:00:00Z`) } },
      data: { stopSell: true, minStay: 2, maxStay: null },
    });
    expect(tx.hotelRoomAvailability.updateMany).not.toHaveBeenCalled();
    expect(tx.hotelRoomRate.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a minimum stay above the maximum', async () => {
    const { service } = setup();
    await expect(
      service.channelInventory({ id: 'p', code: 'acme' }, 'PCM1', { items: [{ roomCode: 'room', start, end, minStay: 5, maxStay: 3 }] }),
    ).rejects.toThrow(BadRequestException);
  });
});
