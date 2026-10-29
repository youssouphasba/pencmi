import {
  hotelRequestSchema,
  hotelStayNights,
  hotelStayQuote,
  HOTEL_RESERVATION_TRANSITIONS,
  hotelToday,
} from './hotel-inventory';

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
      hotelStayQuote(room(), stay, { sourceOfTruth: 'external_system' }),
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
});
