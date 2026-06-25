import { UserRole } from './roles';

export const PERMISSIONS = [
  'publish_real_estate',
  'publish_hotel',
  'publish_vehicle',
  'publish_trip',
  'manage_real_estate',
  'manage_hotels',
  'manage_vehicles',
  'manage_trips',
  'manage_messages',
  'manage_contacts',
  'manage_notifications',
  'manage_content',
  'manage_reports',
  'manage_billing',
  'access_admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  client: ['manage_messages', 'manage_notifications'],
  advertiser_individual: [
    'publish_real_estate',
    'publish_vehicle',
    'publish_trip',
    'manage_real_estate',
    'manage_vehicles',
    'manage_trips',
    'manage_messages',
    'manage_contacts',
    'manage_notifications',
  ],
  real_estate_agency: ['publish_real_estate', 'manage_real_estate', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  hotel_manager: ['publish_hotel', 'manage_hotels', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  vehicle_renter: ['publish_vehicle', 'manage_vehicles', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  vehicle_dealer: ['publish_vehicle', 'manage_vehicles', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  chauffeur: ['publish_vehicle', 'manage_vehicles', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  transport_provider: ['publish_trip', 'manage_trips', 'manage_messages', 'manage_contacts', 'manage_notifications'],
  admin: [...PERMISSIONS],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
