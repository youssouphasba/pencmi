import { mountChannelPartners, mountHotelSync } from './hotel-sync.mjs';

// Runs after hotel-integration.js has drawn the page around these mount points.
document.addEventListener('DOMContentLoaded', () => {
  const hotelier = document.querySelector('#hotel-sync-root');
  if (hotelier) mountHotelSync(hotelier);
  const admin = document.querySelector('#admin-channel-partners-root');
  if (admin) mountChannelPartners(admin);
});
