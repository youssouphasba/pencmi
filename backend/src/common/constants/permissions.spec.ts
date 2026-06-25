import { getPermissionsForRole, hasPermission } from './permissions';

describe('permissions', () => {
  it('grants admin access to admin-only permission', () => {
    expect(hasPermission('admin', 'access_admin')).toBe(true);
  });

  it('does not grant admin access to clients', () => {
    expect(hasPermission('client', 'access_admin')).toBe(false);
  });

  it('grants hotel managers hotel management permissions', () => {
    expect(getPermissionsForRole('hotel_manager')).toContain('manage_hotels');
  });

  it('grants transport providers trip permissions', () => {
    expect(getPermissionsForRole('transport_provider')).toEqual(
      expect.arrayContaining(['publish_trip', 'manage_trips', 'manage_messages']),
    );
  });
});
