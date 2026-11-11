import { navigationLabels as labels } from '../auth/navigation.mjs';

const modules = {
  immobilier: ['immobilier', 'annonces', 'visites', labels.listings],
  hotel: ['hotels', 'annonces', 'reservations', labels.hotels],
  voiture: ['voitures', 'annonces', '', labels.listings],
  voyage: ['voyages', 'trajets', 'reservations', labels.trips],
};
const category = new URLSearchParams(location.search).get('category') || 'immobilier';
const config = modules[category];
if (config) {
  const [module, listings, requests, listingLabel] = config;
  const base = `/dashboard/${module}`;
  const container = document.createElement('aside');
  container.className = 'publication-sidebar';
  const nav = document.createElement('nav');
  nav.id = 'publication-navigation';
  nav.setAttribute('aria-label', labels.menu);
  for (const [label, href] of [
    [labels.overview, `${base}/`], [listingLabel, `${base}/${listings}/`],
    [labels.messages, `${base}/messages/`], [labels.requests, requests ? `${base}/${requests}/` : `${base}/`],
    [labels.contacts, `${base}/contacts/`], [labels.profile, '/dashboard/profil/'],
    [labels.home, '/'],
  ]) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    nav.append(link);
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-ghost publication-menu-toggle';
  toggle.textContent = labels.menu;
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  function close() {
    container.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => {
    const open = container.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && container.classList.contains('is-open')) { close(); toggle.focus(); }
  });
  container.append(toggle, nav);
  const layout = document.createElement('div');
  layout.className = 'publication-workspace';
  const main = document.querySelector('#publish-page');
  main.before(layout);
  layout.append(container, main);
}
