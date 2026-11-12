import { UnauthorizedException } from '@nestjs/common';
import { queueHotelChannelEvent } from '../hotels/hotel-channel-events';
import { hotelCanAutoConfirm, hotelConfirmedExternally, hotelStayQuote } from '../hotels/hotel-inventory';
import { hashChannelSecret, HotelChannelGuard } from './hotel-channel.guard';
import {
  buildIcal,
  fetchIcal,
  HotelIcalError,
  icalStaysFromAllocations,
  isPublicAddress,
  parseIcalNights,
  parseIcalUrl,
} from './hotel-ical';
import { HotelSyncService } from './hotel-sync.service';

const today = new Date('2030-06-01T00:00:00Z');
const calendar = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
const event = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('iCal calendars', () => {
  it('blocks the nights of each event, without the departure day', () => {
    const nights = parseIcalNights(
      calendar(
        event('UID:a', 'DTSTART;VALUE=DATE:20300602', 'DTEND;VALUE=DATE:20300604'),
        event('UID:b', 'DTSTART:20300603T140000Z', 'DTEND:20300605T100000Z'),
      ),
      { unitsPerEvent: 1, today },
    );
    expect(Object.fromEntries(nights)).toEqual({ '2030-06-02': 1, '2030-06-03': 2, '2030-06-04': 1 });
  });

  it('ignores cancelled and free events, unfolds lines and clips the past', () => {
    const nights = parseIcalNights(
      calendar(
        event('DTSTART;VALUE=DATE:20300610', 'DTEND;VALUE=DATE:20300611', 'STATUS:CANCELLED'),
        event('DTSTART;VALUE=DATE:20300612', 'DTEND;VALUE=DATE:20300613', 'TRANSP:TRANSPARENT'),
        event('DTSTART;VALUE=DATE:2030', ' 0530', 'DTEND;VALUE=DATE:20300602'),
        event('DTSTART;VALUE=DATE:20300620'),
      ),
      { unitsPerEvent: 3, today },
    );
    expect(Object.fromEntries(nights)).toEqual({ '2030-06-01': 3, '2030-06-20': 3 });
  });

  it('refuses a page that is not a calendar', () => {
    expect(() => parseIcalNights('<html></html>', { unitsPerEvent: 1, today })).toThrow(HotelIcalError);
  });

  it('publishes one event per reserved unit and reads back the same nights', () => {
    const allocations = [
      { requestId: 'r1', date: new Date('2030-06-02T00:00:00Z'), units: 2 },
      { requestId: 'r1', date: new Date('2030-06-03T00:00:00Z'), units: 2 },
      { requestId: 'r2', date: new Date('2030-06-05T00:00:00Z'), units: 1 },
      { requestId: 'r2', date: new Date('2030-06-07T00:00:00Z'), units: 1 },
    ];
    const stays = icalStaysFromAllocations(allocations);
    expect(stays).toHaveLength(4);
    const text = buildIcal('Pencmi - Hôtel, Dakar; vue mer', stays, today);
    expect(text).toContain('X-WR-CALNAME:Pencmi - Hôtel\\, Dakar\\; vue mer');
    expect(text).not.toMatch(/[^\r]\n/);
    expect(Object.fromEntries(parseIcalNights(text, { unitsPerEvent: 1, today }))).toEqual({
      '2030-06-02': 2, '2030-06-03': 2, '2030-06-05': 1, '2030-06-07': 1,
    });
  });

  it('only reads links to public web hosts', () => {
    for (const bad of [
      'ftp://example.com/a.ics', 'https://localhost/a.ics', 'http://127.0.0.1/a.ics', 'http://10.1.2.3/a.ics',
      'http://169.254.169.254/latest', 'http://[::1]/a.ics', 'http://[::ffff:127.0.0.1]/a.ics',
      'https://user:pass@example.com/a.ics', 'https://example.com:8443/a.ics', 'https://intranet/a.ics',
    ])
      expect(() => parseIcalUrl(bad)).toThrow(HotelIcalError);
    expect(parseIcalUrl('webcal://calendar.example.com/room.ics').toString()).toBe('https://calendar.example.com/room.ics');
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('192.168.1.10')).toBe(false);
    expect(isPublicAddress('fd00::1')).toBe(false);
  });

  it('checks every redirect like the link itself', async () => {
    const redirect = jest.fn(async () => ({ status: 302, location: 'http://127.0.0.1/admin' }));
    await expect(fetchIcal('https://calendar.example.com/a.ics', redirect)).rejects.toThrow('site public');
    const missing = jest.fn(async () => ({ status: 404 }));
    await expect(fetchIcal('https://calendar.example.com/a.ics', missing)).rejects.toThrow('n’existe plus');
    const ok = jest
      .fn()
      .mockResolvedValueOnce({ status: 301, location: '/b.ics' })
      .mockResolvedValueOnce({ status: 200, body: 'BEGIN:VCALENDAR' });
    await expect(fetchIcal('https://calendar.example.com/a.ics', ok)).resolves.toBe('BEGIN:VCALENDAR');
    expect(ok.mock.calls[1][0].toString()).toBe('https://calendar.example.com/b.ics');
  });
});

describe('stock of a synchronised hotel', () => {
  const now = new Date();
  const day = (offset: number) => new Date(Date.UTC(now.getUTCFullYear() + 1, 5, 1 + offset)).toISOString().slice(0, 10);
  const stay = { roomId: 'room', checkIn: day(0), checkOut: day(2), guests: 2, units: 1 };
  const room = (extra: any = {}) =>
    ({
      id: 'room', capacity: 2, metadata: { totalUnits: 2, basePrice: 15000 },
      rates: [], restrictions: [], availability: [], stockAllocations: [],
      icalImports: [], externalBlocks: [], ...extra,
    }) as any;
  const ical = { status: 'active', syncMode: 'ical', sourceOfTruth: 'pencmi', autoConfirm: true };
  const channel = { id: 'i', status: 'active', syncMode: 'channel_manager', sourceOfTruth: 'pencmi', autoConfirm: true };

  it('opens the whole stock on a fresh calendar, minus the nights it blocks', () => {
    const fresh = room({
      icalImports: [{ lastSuccessAt: new Date() }],
      externalBlocks: [{ date: `${day(1)}T00:00:00.000Z`, units: 1 }],
    });
    const quote = hotelStayQuote(fresh, stay, ical);
    expect(quote).toMatchObject({ status: 'on_request', canConfirm: true, remainingUnits: 1 });
    expect(hotelCanAutoConfirm(ical, fresh, quote)).toBe(true);
    const full = room({ ...fresh, externalBlocks: [{ date: `${day(1)}T00:00:00.000Z`, units: 2 }] });
    expect(hotelStayQuote(full, stay, ical)).toMatchObject({ status: 'unavailable', canConfirm: false });
  });

  it('stops confirming on its own once the calendar is stale', () => {
    const stale = room({ icalImports: [{ lastSuccessAt: new Date(Date.now() - 4 * 3600_000) }] });
    const quote = hotelStayQuote(stale, stay, ical);
    expect(quote.canConfirm).toBe(false);
    expect(hotelCanAutoConfirm(ical, stale, quote)).toBe(false);
    expect(hotelCanAutoConfirm({ ...ical, status: 'inactive' }, stale, { canConfirm: true })).toBe(false);
  });

  it('counts a reservation once the channel manager sent availability after acknowledging it', () => {
    const ackedAt = new Date(Date.now() - 60_000);
    const allocations = [day(0), day(1)].map((date) => ({ date, units: 1, releasedAt: null, channelAckedAt: ackedAt }));
    const availability = (updatedAt: Date) =>
      [day(0), day(1)].map((date) => ({ date, available: 5, status: 'open', updatedAt }));
    const rates = [day(0), day(1)].map((date) => ({ date, ratePlan: 'channel', price: 20000, currency: 'FCFA' }));
    const after = hotelStayQuote(room({ availability: availability(new Date()), stockAllocations: allocations, rates }), stay, channel);
    expect(after).toMatchObject({ canConfirm: true, remainingUnits: 5, estimatedTotal: 40000 });
    const before = hotelStayQuote(
      room({ availability: availability(new Date(Date.now() - 3600_000)), stockAllocations: allocations, rates }),
      stay,
      channel,
    );
    expect(before.remainingUnits).toBe(4);
  });

  it('keeps Pencmi in charge of inactive integrations', () => {
    expect(hotelConfirmedExternally({ status: 'inactive', sourceOfTruth: 'external_system' })).toBe(false);
    expect(hotelConfirmedExternally({ status: 'active', sourceOfTruth: 'external_system' })).toBe(true);
  });
});

describe('channel manager events', () => {
  const integration = { id: 'i', status: 'active', syncMode: 'channel_manager' };
  const tx = (commit: any, withdrawn = 1) =>
    ({
      hotelChannelEvent: {
        findUnique: jest.fn(async () => commit),
        deleteMany: jest.fn(async () => ({ count: withdrawn })),
        upsert: jest.fn(async () => ({})),
      },
    }) as any;

  it('withdraws a reservation the channel manager never read', async () => {
    const client = tx({ id: 'e', deliveredAt: null });
    await queueHotelChannelEvent(client, integration, 'r', 'cancel');
    expect(client.hotelChannelEvent.deleteMany).toHaveBeenCalledWith({ where: { id: 'e', deliveredAt: null } });
    expect(client.hotelChannelEvent.upsert).not.toHaveBeenCalled();
  });

  it('sends a cancellation once the reservation was read', async () => {
    const client = tx({ id: 'e', deliveredAt: new Date() }, 0);
    await queueHotelChannelEvent(client, integration, 'r', 'cancel');
    expect(client.hotelChannelEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { integrationId: 'i', requestId: 'r', kind: 'cancel' } }),
    );
  });

  it('queues nothing without an active channel manager', async () => {
    const client = tx(null);
    await queueHotelChannelEvent(client, { ...integration, syncMode: 'ical' }, 'r', 'commit');
    await queueHotelChannelEvent(client, { ...integration, status: 'inactive' }, 'r', 'commit');
    expect(client.hotelChannelEvent.upsert).not.toHaveBeenCalled();
  });
});

describe('channel manager access', () => {
  const secret = `pcmcm_${'a'.repeat(64)}`;
  const context = (headers: Record<string, string>) => {
    const request: any = { headers };
    return { request, ctx: { switchToHttp: () => ({ getRequest: () => request }) } as any };
  };
  const guard = (partner: any) =>
    new HotelChannelGuard({ hotelChannelPartner: { findUnique: jest.fn(async () => partner) } } as any);

  it('accepts the partner secret and nothing else', async () => {
    const partner = { id: 'p', code: 'acme', active: true, secretHash: hashChannelSecret(secret) };
    const ok = context({ 'x-channel-partner': 'acme', 'x-channel-secret': secret });
    await expect(guard(partner).canActivate(ok.ctx)).resolves.toBe(true);
    expect(ok.request.channelPartner).toEqual({ id: 'p', code: 'acme' });
    const wrong = context({ 'x-channel-partner': 'acme', 'x-channel-secret': `pcmcm_${'b'.repeat(64)}` });
    await expect(guard(partner).canActivate(wrong.ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard({ ...partner, active: false }).canActivate(ok.ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard(null).canActivate(ok.ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('serves a hotel only to the channel manager it selected', async () => {
    const integration = {
      id: 'i', propertyId: 'h', status: 'active', syncMode: 'channel_manager', channelPartnerId: 'p',
      property: { id: 'h', deletedAt: null },
    };
    const prisma: any = {
      hotelIntegration: { findUnique: jest.fn(async () => integration) },
      hotelRoom: { findMany: jest.fn(async () => [{ id: 'room', name: 'Double', roomType: null, capacity: 2, status: 'active' }]) },
    };
    const service = new HotelSyncService(prisma);
    await expect(service.channelRooms({ id: 'p', code: 'acme' }, 'PCM1')).resolves.toMatchObject({
      rooms: [{ roomCode: 'room', bookable: true }],
    });
    await expect(service.channelRooms({ id: 'other', code: 'x' }, 'PCM1')).rejects.toThrow('Établissement inconnu');
    integration.syncMode = 'ical';
    await expect(service.channelRooms({ id: 'p', code: 'acme' }, 'PCM1')).rejects.toThrow('Établissement inconnu');
  });

  it('refuses inventory for a room of another hotel', async () => {
    const prisma: any = {
      hotelIntegration: {
        findUnique: jest.fn(async () => ({
          id: 'i', propertyId: 'h', status: 'active', syncMode: 'channel_manager', channelPartnerId: 'p',
          property: { id: 'h', deletedAt: null },
        })),
      },
      hotelRoom: { findMany: jest.fn(async () => [{ id: 'room' }]) },
      $transaction: jest.fn(),
    };
    const service = new HotelSyncService(prisma);
    const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await expect(
      service.channelInventory({ id: 'p', code: 'acme' }, 'PCM1', { items: [{ roomCode: 'foreign', start, end: start, available: 1 }] }),
    ).rejects.toThrow('Chambre inconnue');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
