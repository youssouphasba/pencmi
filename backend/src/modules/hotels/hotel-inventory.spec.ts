import {
  hasHotelPublicFilters,
  hotelMatchesPublicFilters,
  hotelRequestSchema,
  hotelSearchStay,
  hotelStayNights,
  hotelStayQuote,
  HOTEL_RESERVATION_TRANSITIONS,
  hotelToday,
} from './hotel-inventory';
import { hotelHasUnreconciledReservations } from './hotel-reservations.service';
import { HotelsService } from './hotels.service';

describe('Hotel stay and inventory rules', () => {
  const start = '2030-06-01';
  const end = '2030-06-03';
  const stay = {
    roomId: 'room',
    checkIn: start,
    checkOut: end,
    guests: 2,
    units: 1,
  };
  const room = () =>
    ({
      id: 'room',
      capacity: 2,
      metadata: { totalUnits: 2, basePrice: 15000 },
      rates: [],
      restrictions: [],
      availability: [start, '2030-06-02'].map((date) => ({
        date,
        available: 2,
        status: 'open',
      })),
      stockAllocations: [],
    }) as any;

  describe('stay search across the rooms of a property', () => {
    const search = { checkIn: start, checkOut: end, guests: 2, rooms: 1 };
    const property = (...rooms: any[]) => ({
      rooms: rooms.map((data, index) => ({
        ...room(),
        id: `room-${index}`,
        status: 'active',
        ...data,
      })),
    });

    it('keeps the cheapest room with confirmed stock and ignores inactive rooms', () => {
      const result = hotelSearchStay(
        property(
          { metadata: { totalUnits: 2, basePrice: 40000 } },
          { metadata: { totalUnits: 2, basePrice: 20000 } },
          { metadata: { totalUnits: 2, basePrice: 1000 }, status: 'draft' },
        ),
        search,
      );
      expect(result).toMatchObject({
        roomId: 'room-1',
        status: 'on_request',
        nights: 2,
        estimatedTotal: 40000,
      });
    });
    it('books enough units for every guest and gives up beyond ten units', () => {
      const big = property({
        metadata: { totalUnits: 3, basePrice: 10000 },
        availability: [start, '2030-06-02'].map((date) => ({
          date,
          available: 3,
          status: 'open',
        })),
      });
      expect(hotelSearchStay(big, { ...search, guests: 5 })).toMatchObject({
        units: 3,
        status: 'on_request',
      });
      expect(hotelSearchStay(big, { ...search, guests: 30 })).toBeNull();
    });
    it('excludes full, closed or stop-sell properties', () => {
      const full = property({
        stockAllocations: [{ date: start, units: 2 }],
      });
      const closed = property({
        availability: [start, '2030-06-02'].map((date) => ({
          date,
          available: 2,
          status: 'closed',
        })),
      });
      const stopped = property({
        restrictions: [{ date: start, stopSell: true }],
      });
      for (const data of [full, closed, stopped])
        expect(hotelSearchStay(data, search)).toBeNull();
      expect(hotelSearchStay(property(), { ...search, rooms: 3 })).toBeNull();
    });
    it('keeps a property without calendar as unconfirmed, after confirmed ones', () => {
      const result = hotelSearchStay(
        property({ availability: [] }, {}),
        search,
      );
      expect(result).toMatchObject({ roomId: 'room-1', status: 'on_request' });
      expect(
        hotelSearchStay(property({ availability: [] }), search),
      ).toMatchObject({
        status: 'unconfirmed',
        reason: 'availability_unknown',
      });
    });
  });

  it('uses Dakar date and excludes the departure night', () => {
    expect(hotelToday(new Date('2030-06-01T23:59:00Z'))).toBe(start);
    expect(hotelStayNights(start, end)).toEqual([start, '2030-06-02']);
  });
  it.each([
    ['2030-02-30', end],
    [end, start],
    [start, start],
    ['2000-01-01', '2000-01-02'],
    [start, '2031-06-01'],
  ])('refuses invalid stay %s %s', (from, to) => {
    expect(() => hotelStayNights(from, to)).toThrow();
  });
  it('subtracts live allocations exactly once without changing initial stock', () => {
    const data = room();
    data.stockAllocations = [
      { date: start, units: 1 },
      { date: start, units: 10, releasedAt: new Date() },
    ];
    expect(hotelStayQuote(data, stay)).toMatchObject({
      canConfirm: true,
      remainingUnits: 1,
      estimatedTotal: 30000,
    });
    expect(data.availability[0].available).toBe(2);
    expect(hotelStayQuote(data, { ...stay, units: 2 })).toMatchObject({
      canConfirm: false,
      reason: 'stock_insufficient',
    });
  });
  it('does not infer stock or price from missing data', () => {
    const data = room();
    data.availability.pop();
    delete data.metadata.basePrice;
    expect(hotelStayQuote(data, stay)).toMatchObject({
      canConfirm: false,
      remainingUnits: null,
      estimatedTotal: null,
      reason: 'availability_unknown',
    });
  });
  it.each(['closed', 'full', 'maintenance'])('rejects %s periods', (status) => {
    const data = room();
    data.availability[0].status = status;
    expect(hotelStayQuote(data, stay).status).toBe('unavailable');
  });
  it('enforces capacity, stopSell, stay restrictions and expired availability', () => {
    expect(() => hotelStayQuote(room(), { ...stay, guests: 3 })).toThrow();
    const data = room();
    data.restrictions = [{ date: start, stopSell: true }];
    expect(hotelStayQuote(data, stay).reason).toBe('stop_sell');
    data.restrictions = [{ date: start, minStay: 3 }];
    expect(hotelStayQuote(data, stay).reason).toBe('stay_restriction');
    data.restrictions = [{ date: start, maxStay: 1 }];
    expect(hotelStayQuote(data, stay).reason).toBe('stay_restriction');
    data.restrictions = [];
    data.availability[0].reliableUntil = new Date(0);
    expect(hotelStayQuote(data, stay).canConfirm).toBe(false);
  });
  it('never confirms external stock locally', () => {
    expect(
      hotelStayQuote(room(), stay, { status: 'active', sourceOfTruth: 'external_system' }),
    ).toMatchObject({
      canConfirm: false,
      remainingUnits: null,
      reason: 'external_confirmation_required',
    });
  });
  it('rejects injected fields, nonpositive units and blank names', () => {
    const input = {
      ...stay,
      requestId: 'a813c505-8547-467c-b978-b2a21a2ee519',
      clientName: 'Client',
      clientEmail: 'client@example.test',
    };
    expect(hotelRequestSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { ownerUserId: 'other' },
      { status: 'accepted' },
      { units: 0 },
      { clientName: '  ' },
      { clientEmail: 'bad' },
    ])
      expect(
        hotelRequestSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
  it('blocks unreconciled accepted history only for potentially overlapping rooms and dates', () => {
    const old = {
      status: 'accepted',
      roomId: null,
      checkIn: new Date(start),
      checkOut: new Date(end),
      units: null,
      allocations: [],
    };
    expect(hotelHasUnreconciledReservations([old], stay)).toBe(true);
    expect(
      hotelHasUnreconciledReservations(
        [{ ...old, checkIn: null, checkOut: null }],
        stay,
      ),
    ).toBe(true);
    expect(
      hotelHasUnreconciledReservations(
        [{ ...old, checkOut: new Date('2030-05-31') }],
        stay,
      ),
    ).toBe(true);
    expect(
      hotelHasUnreconciledReservations([{ ...old, roomId: 'other' }], stay),
    ).toBe(false);
    expect(
      hotelHasUnreconciledReservations([{ ...old, status: 'refused' }], stay),
    ).toBe(false);
    expect(
      hotelHasUnreconciledReservations(
        [
          {
            ...old,
            checkIn: new Date('2030-05-29'),
            checkOut: new Date(start),
          },
        ],
        stay,
      ),
    ).toBe(false);
    const confirmed = {
      ...old,
      roomId: 'room',
      units: 1,
      allocations: [start, '2030-06-02'].map((date) => ({
        date,
        roomId: 'room',
        units: 1,
      })),
    };
    expect(hotelHasUnreconciledReservations([confirmed], stay)).toBe(false);
    expect(
      hotelHasUnreconciledReservations(
        [{ ...confirmed, allocations: confirmed.allocations.slice(1) }],
        stay,
      ),
    ).toBe(true);
  });
  it('has explicit terminal transitions and cancellation of confirmed stays', () => {
    for (const status of [
      'cancelled',
      'refused',
      'expired',
      'completed',
    ] as const)
      expect(HOTEL_RESERVATION_TRANSITIONS[status]).toEqual([]);
    expect(HOTEL_RESERVATION_TRANSITIONS.accepted).toEqual([
      'refused',
      'cancelled',
      'completed',
    ]);
  });

  describe('public filters applied to the whole search', () => {
    const hotel = (metadata: any, extra: any = {}) => ({
      name: 'Résidence Téranga',
      propertyType: 'residence',
      city: 'Saint-Louis',
      region: 'Saint-Louis',
      description: 'Vue sur le fleuve',
      metadata,
      ...extra,
    });

    it('detects whether a filter was requested', () => {
      expect(hasHotelPublicFilters({})).toBe(false);
      expect(hasHotelPublicFilters({ query: '  ', amenity: '' })).toBe(false);
      expect(hasHotelPublicFilters({ stars: 3 })).toBe(true);
      expect(hasHotelPublicFilters({ query: 'saly' })).toBe(true);
    });

    it('matches text without accents or case and amenities without punctuation', () => {
      const item = hotel({ amenities: ['Wi-Fi', 'Piscine'], stars: 3 });
      expect(hotelMatchesPublicFilters(item, { query: 'teranga' })).toBe(true);
      expect(hotelMatchesPublicFilters(item, { query: 'saint louis' })).toBe(
        true,
      );
      expect(hotelMatchesPublicFilters(item, { query: 'dakar' })).toBe(false);
      expect(hotelMatchesPublicFilters(item, { amenity: 'wifi' })).toBe(true);
      expect(hotelMatchesPublicFilters(item, { amenity: 'Parking' })).toBe(
        false,
      );
      expect(hotelMatchesPublicFilters(item, { stars: 3 })).toBe(true);
      expect(hotelMatchesPublicFilters(item, { stars: 4 })).toBe(false);
      expect(hotelMatchesPublicFilters(hotel({}), { stars: 1 })).toBe(false);
    });

    it('keeps an unknown price under a maximum budget but not above a minimum', () => {
      const priced = hotel({ nightlyPrice: 30000 });
      const unknown = hotel({ nightlyPrice: null });
      expect(hotelMatchesPublicFilters(priced, { minPrice: 30000 })).toBe(true);
      expect(hotelMatchesPublicFilters(priced, { minPrice: 30001 })).toBe(
        false,
      );
      expect(hotelMatchesPublicFilters(priced, { maxPrice: 29999 })).toBe(
        false,
      );
      expect(hotelMatchesPublicFilters(unknown, { maxPrice: 1000 })).toBe(true);
      expect(hotelMatchesPublicFilters(unknown, { minPrice: 1000 })).toBe(
        false,
      );
    });

    it('filters every matching property before paginating', async () => {
      const row = (index: number) => ({
        id: `hotel-${index}`,
        slug: `hotel-${index}`,
        name: `Hôtel ${index}`,
        propertyType: 'hotel',
        city: 'Dakar',
        status: 'active',
        rooms: [],
        // Only the properties of the "second page" have a pool.
        contactSettings: {
          nightlyPrice: 10000 + index,
          amenities: index >= 20 ? ['Piscine'] : ['Parking'],
        },
      });
      const findMany = jest
        .fn()
        .mockResolvedValue(Array.from({ length: 45 }, (_, i) => row(i)));
      const count = jest.fn().mockResolvedValue(45);
      const service = new HotelsService(
        { hotelProperty: { findMany, count } } as any,
        {} as any,
      );

      const filtered = await service.findPublic({
        page: 2,
        limit: 20,
        amenity: 'piscine',
      } as any);
      expect(filtered.meta).toMatchObject({ total: 25, totalPages: 2 });
      expect(filtered.data.map((item: any) => item.id)).toEqual([
        'hotel-40',
        'hotel-41',
        'hotel-42',
        'hotel-43',
        'hotel-44',
      ]);
      expect(findMany.mock.calls[0][0].skip).toBeUndefined();
      expect(count).not.toHaveBeenCalled();

      // Without a filter the database paginates.
      await service.findPublic({ page: 2, limit: 20 } as any);
      expect(findMany.mock.calls[1][0]).toMatchObject({ skip: 20, take: 20 });
      expect(count).toHaveBeenCalledTimes(1);
    });
  });
});
