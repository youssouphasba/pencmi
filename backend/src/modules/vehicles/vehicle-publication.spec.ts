import {
  validateVehiclePublication,
  validateVehicleSubmission,
  vehiclePrimaryPrice,
} from './vehicle-publication.schema';

import { completeVehicle } from './vehicle-publication.test-data';
describe('Vehicle publication validation', () => {
  it('allows empty drafts, but not empty submissions', () => {
    expect(validateVehiclePublication({})).toEqual({});
    expect(() => validateVehicleSubmission({})).toThrow();
  });
  it.each(['sale', 'rental', 'chauffeur'] as const)(
    'accepts a complete %s submission with the right price',
    (vehicleMode) => {
      const data = validateVehiclePublication({
        ...completeVehicle,
        vehicleMode,
      });
      expect(() => validateVehicleSubmission(data)).not.toThrow();
      expect(vehiclePrimaryPrice(vehicleMode, data.metadata!.pricing!)).toBe(
        { sale: 9000000, rental: 25000, chauffeur: 20000 }[vehicleMode],
      );
    },
  );
  it.each([
    { status: 'active' },
    { ownerUserId: 'another' },
    { slug: 'forced' },
    { metadata: { admin: true } },
    { metadata: { identity: { verified: true } } },
    { metadata: { pricing: { price: -1 } } },
    { metadata: { documents: ['https://private/document.pdf'] } },
    { metadata: { info: { seats: -1 } } },
    { metadata: { contactPreferences: { permissions: ['admin'] } } },
  ])('rejects sensitive or invalid payload %j', (input) =>
    expect(() => validateVehiclePublication(input)).toThrow(),
  );
  it('does not treat internal messaging alone as an operational contact channel', () => {
    expect(() =>
      validateVehicleSubmission(
        validateVehiclePublication({
          ...completeVehicle,
          metadata: {
            ...completeVehicle.metadata,
            contactPreferences: { internalMessagingEnabled: true },
          },
        }),
      ),
    ).toThrow();
  });
  it('requires the price for the selected mode only', () => {
    expect(() =>
      validateVehicleSubmission(
        validateVehiclePublication({
          ...completeVehicle,
          vehicleMode: 'rental',
          metadata: {
            ...completeVehicle.metadata,
            pricing: { price: 9000000 },
          },
        }),
      ),
    ).toThrow();
  });
});
