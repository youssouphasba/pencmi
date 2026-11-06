import { apiRequest, el, ensureStyles, hasSession, loginHref } from '../messaging/messaging-ui.mjs';

const CSS = new URL('./saved.css', import.meta.url).href;
export function ensureSavedStyles() {
  ensureStyles();
  if (!document.querySelector('link[data-pencmi-saved]')) document.head.append(el('link', { rel: 'stylesheet', href: CSS, 'data-pencmi-saved': 'true' }));
}

const LABEL_ADD = 'Ajouter aux favoris';
const LABEL_REMOVE = 'Retirer des favoris';

function mountButton(host, saved) {
  const { favoriteModule: module, favoriteId: id } = host.dataset;
  const status = el('span', { class: 'pm-status', role: 'status' });
  const button = el('button', { class: 'btn btn-ghost', type: 'button' });
  const show = (value) => {
    button.setAttribute('aria-pressed', String(value));
    button.textContent = value ? `♥ ${LABEL_REMOVE}` : `♡ ${LABEL_ADD}`;
  };
  let current = saved;
  show(current);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.className = 'pm-status';
    status.textContent = 'Enregistrement…';
    const wanted = !current;
    try {
      // Both calls are idempotent: trying again after an error is always safe.
      await apiRequest(`/favorites/${encodeURIComponent(module)}/${encodeURIComponent(id)}`, { method: wanted ? 'PUT' : 'DELETE' });
      current = wanted;
      show(current);
      status.textContent = '';
    } catch (error) {
      status.className = 'pm-status pm-error';
      status.textContent = error.status === 401 ? 'Votre session a expiré. Reconnectez-vous.' : error.message || 'Action impossible. Réessayez.';
    } finally {
      button.disabled = false;
    }
  });
  host.classList.add('sv-favorite');
  host.replaceChildren(button, status);
}

async function enhanceFavorites(hosts) {
  if (!hosts.length) return;
  hosts.forEach((host) => { host.dataset.favoriteReady = 'true'; });
  ensureSavedStyles();
  if (!hasSession()) {
    hosts.forEach((host) => { host.classList.add('sv-favorite'); host.replaceChildren(el('a', { class: 'btn btn-ghost', href: loginHref(), text: `♡ ${LABEL_ADD}` })); });
    return;
  }
  const byModule = new Map();
  for (const host of hosts) byModule.set(host.dataset.favoriteModule, [...(byModule.get(host.dataset.favoriteModule) || []), host]);
  await Promise.all([...byModule].map(async ([module, group]) => {
    let saved = new Set();
    let known = true;
    try {
      for (let start = 0; start < group.length; start += 100) {
        const ids = [...new Set(group.slice(start, start + 100).map((host) => host.dataset.favoriteId))];
        const result = await apiRequest(`/favorites/check?module=${encodeURIComponent(module)}&ids=${ids.map(encodeURIComponent).join(',')}`);
        result.favorites.forEach((id) => saved.add(id));
      }
    } catch {
      known = false;
    }
    group.forEach((host) => {
      mountButton(host, saved.has(host.dataset.favoriteId));
      if (!known) host.querySelector('.pm-status').textContent = 'État des favoris non confirmé.';
    });
  }));
}

const CRITERIA = {
  real_estate: { transaction: 'transaction', type: 'propertyType', city: 'city', location: 'city', maxPrice: '#maxPrice' },
  hotels: { city: 'city', type: 'propertyType', propertyType: 'propertyType' },
  vehicles: { type: 'vehicleMode', brand: 'brand', model: 'model', city: 'city', minPrice: '#minPrice', maxPrice: '#maxPrice', fuel: 'fuel', gearbox: 'gearbox' },
  trips: { depart: 'departureCity', departureCity: 'departureCity', arrivee: 'arrivalCity', arrivalCity: 'arrivalCity', date: 'date', passengers: '#passengers', vehicleType: 'vehicleType', minPrice: '#minPrice', maxPrice: '#maxPrice', timeOfDay: 'timeOfDay' },
};

/** Only what the visitor really chose in the address of the search, never the labels on screen. */
export function filtersFromSearch(module, search) {
  const params = new URLSearchParams(search);
  const filters = {};
  for (const [param, target] of Object.entries(CRITERIA[module])) {
    const value = params.get(param)?.trim();
    if (!value) continue;
    if (target.startsWith('#')) {
      const number = Number(value);
      if (Number.isInteger(number)) filters[target.slice(1)] = number;
    } else filters[target] = value;
  }
  // One passenger is the default of the form, not a choice.
  if (module === 'trips' && filters.passengers === 1) delete filters.passengers;
  return filters;
}

function mountSaveSearch(host) {
  host.dataset.saveReady = 'true';
  const module = host.dataset.saveSearch;
  const filters = filtersFromSearch(module, window.location.search);
  if (!Object.keys(filters).length) return;
  ensureSavedStyles();
  host.classList.add('sv-save-search');
  if (!hasSession()) {
    host.replaceChildren(el('a', { class: 'btn btn-light', href: loginHref(), text: 'Se connecter pour enregistrer cette recherche' }));
    return;
  }
  const status = el('span', { class: 'pm-status', role: 'status' });
  const button = el('button', { class: 'btn btn-light', type: 'button', text: 'Enregistrer cette recherche', onClick: async () => {
    if (button.disabled) return;
    button.disabled = true;
    status.className = 'pm-status';
    status.textContent = 'Enregistrement…';
    try {
      await apiRequest('/saved-alerts', { method: 'POST', body: { module, name: Object.values(filters).join(' · ').slice(0, 120).padEnd(2, '.'), filters } });
      status.textContent = 'Recherche enregistrée dans vos alertes.';
    } catch (error) {
      status.className = 'pm-status pm-error';
      status.textContent = error.message || 'Enregistrement impossible. Réessayez.';
      button.disabled = false;
    }
  } });
  host.replaceChildren(button, status);
}

function scan() {
  void enhanceFavorites([...document.querySelectorAll('[data-favorite-id]:not([data-favorite-ready])')]);
  document.querySelectorAll('[data-save-search]:not([data-save-ready])').forEach(mountSaveSearch);
}

scan();
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
