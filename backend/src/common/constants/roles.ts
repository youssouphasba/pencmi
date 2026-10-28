export const USER_ROLES = [
  'client',
  'advertiser_individual',
  'real_estate_agency',
  'hotel_manager',
  'vehicle_renter',
  'vehicle_dealer',
  'chauffeur',
  'transport_provider',
  'admin',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const PUBLIC_REGISTRATION_ROLES = [
  'client',
  'advertiser_individual',
  'real_estate_agency',
  'hotel_manager',
  'vehicle_renter',
  'vehicle_dealer',
  'chauffeur',
  'transport_provider',
] as const satisfies readonly UserRole[];

export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];
