import { randomUUID } from 'crypto';
import {
  validateHotelPublication,
  validateHotelSubmission,
  hotelPeriodDays,
} from './hotel-publication.schema';
import { HotelsService } from './hotels.service';

describe('Hotel publication validation and public boundaries', () => {
  it('keeps incomplete contact coordinates in drafts but refuses submission', () => {
    const data = validateHotelPublication({
      metadata: {
        contactPreferences: { phoneEnabled: true, phoneNumber: '77' },
      },
    });
    expect(data.metadata!.contactPreferences!.phoneNumber).toBe('77');
    expect(() => validateHotelSubmission(data)).toThrow();
  });
  const room = () => ({
    clientId: randomUUID(),
    name: 'Double',
    capacity: 3,
    adults: 2,
    children: 1,
    beds: 1,
    totalUnits: 4,
    basePrice: 25000,
    currency: 'FCFA',
  });
  it('accepts incomplete drafts', () =>
    expect(validateHotelPublication({})).toEqual({}));
  it('keeps partially entered date periods in drafts', () => {
    const data = validateHotelPublication({
      rooms: [{ ...room(), rates: [{ start: '', end: '', currency: 'FCFA' }] }],
    });
    expect(data.rooms![0].rates![0].start).toBe('');
    expect(() => validateHotelSubmission(data)).toThrow();
  });
  it.each(['ownerUserId', 'status', 'slug', 'permissions'])(
    'rejects injected %s',
    (key) =>
      expect(() => validateHotelPublication({ [key]: 'active' })).toThrow(),
  );
  it('refuses an incomplete submission', () =>
    expect(() => validateHotelSubmission({})).toThrow());
  it('accepts a complete submission without requiring photos', () => {
    const data = validateHotelPublication({
      name: 'Maison',
      city: 'Dakar',
      propertyType: 'hotel',
      description: 'Description',
      rooms: [room()],
      metadata: { contactPreferences: { internalMessagingEnabled: true } },
    });
    expect(() => validateHotelSubmission(data)).not.toThrow();
  });
  it('does not count email notifications as a contact channel', () => {
    expect(() =>
      validateHotelSubmission(
        validateHotelPublication({
          metadata: {
            contactPreferences: {
              emailNotificationsEnabled: true,
              notificationEmail: 'owner@example.com',
            },
          },
        }),
      ),
    ).toThrow();
  });
  it('rejects negative quantities', () =>
    expect(() =>
      validateHotelPublication({ rooms: [{ ...room(), totalUnits: -1 }] }),
    ).toThrow());
  it('rejects stocks exceeding inventory', () =>
    expect(() =>
      validateHotelPublication({
        rooms: [
          {
            ...room(),
            calendar: [
              {
                start: '2026-11-01',
                end: '2026-11-02',
                status: 'open',
                available: 5,
                stopSell: false,
              },
            ],
          },
        ],
      }),
    ).toThrow());
  it('rejects nonzero stock during maintenance', () =>
    expect(() =>
      validateHotelPublication({
        rooms: [
          {
            ...room(),
            calendar: [
              {
                start: '2026-11-01',
                end: '2026-11-02',
                status: 'maintenance',
                available: 1,
                stopSell: false,
              },
            ],
          },
        ],
      }),
    ).toThrow());
  it('rejects invalid dates and overlapping periods', () => {
    expect(() =>
      validateHotelPublication({
        rooms: [
          {
            ...room(),
            rates: [
              {
                start: '2026-02-30',
                end: '2026-03-01',
                price: 100,
                currency: 'FCFA',
              },
            ],
          },
        ],
      }),
    ).toThrow();
    const period = {
      start: '2026-11-01',
      end: '2026-11-02',
      price: 100,
      currency: 'FCFA',
    };
    expect(() =>
      validateHotelPublication({
        rooms: [{ ...room(), rates: [period, period] }],
      }),
    ).toThrow();
  });
  it('rejects an unsupported automatic management mode', () =>
    expect(() =>
      validateHotelPublication({
        metadata: { management: { mode: 'automatic' } },
      }),
    ).toThrow());
  it('uses date-only inclusive periods across month boundaries', () =>
    expect(hotelPeriodDays('2026-10-31', '2026-11-02')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]));
  it('projects only public hotel fields and no unconfirmed inventory', () => {
    const service = new HotelsService({} as any);
    const output = service.publicProperty({
      id: 'h',
      name: 'H',
      address: 'Private',
      ownerUserId: 'private',
      contactSettings: {
        secretHash: 'secret',
        photos: [],
        publication: {
          contactPreferences: {
            notificationEmail: 'private@example.com',
            contactEmail: 'secret@example.com',
            emailEnabled: false,
          },
        },
      },
      integration: { sourceOfTruth: 'external_system', status: 'inactive' },
      rooms: [
        {
          id: 'r',
          status: 'active',
          metadata: { basePrice: 0 },
          rates: [],
          restrictions: [],
          availability: [
            {
              date: new Date(),
              available: 3,
              status: 'open',
              reliableUntil: null,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(output)).not.toContain('private');
    expect(JSON.stringify(output)).not.toContain('secret');
    expect(output.metadata.priceFrom).toBe(0);
    expect(output.rooms[0].availability[0].status).toBe('unconfirmed');
  });
});
