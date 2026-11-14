// Shared shell for professional and admin spaces. Each space renders its own markup;
// this module adds what they all need and re-applies it after every re-render:
// a top bar (logo, notifications, back to the site), an icon menu button, logout in
// the menu, a closable menu (tap outside, Escape), and tables readable on phones.
const isAdmin = location.pathname.startsWith('/admin');
const SIDEBARS = '.dashboard-sidebar, .admin-sidebar';
const TOGGLES = '[data-open-sidebar], [data-open-admin-sidebar]';
const LOGOUTS = '[data-dashboard-logout], [data-admin-logout]';
const TABLES = '.hotel-table, .vehicle-table, .trip-table, .performance-table, .admin-table, .content-table-shell table';

function spaceHome() {
  if (isAdmin) return '/admin/';
  const universe = location.pathname.match(/^\/dashboard\/(immobilier|hotels|voitures|voyages)\//);
  return universe ? `/dashboard/${universe[1]}/` : '/dashboard/';
}

function addStyles() {
  if (document.querySelector('link[data-space-shell]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/dashboard/space-shell.css?v=20261114-5';
  link.dataset.spaceShell = '';
  document.head.append(link);
}

function link(text, href, className, label) {
  const a = document.createElement('a');
  a.href = href;
  a.className = className;
  if (label) a.setAttribute('aria-label', label);
  a.append(text);
  return a;
}

function topbar() {
  if (document.querySelector('.space-topbar')) return;
  const bar = document.createElement('div');
  bar.className = 'space-topbar';
  const brand = link('', '/', 'space-brand', 'Accueil du site Péncmi');
  const img = document.createElement('img');
  img.src = '/Logo%20pencmi.jpeg'; img.alt = ''; img.width = 36; img.height = 36;
  const name = document.createElement('span');
  name.textContent = 'Péncmi';
  brand.append(img, name);
  const actions = document.createElement('div');
  actions.className = 'space-topbar-actions';
  const home = link('Mon espace', spaceHome(), 'space-pill space-home');
  const bellIcon = document.createElement('span'); bellIcon.setAttribute('aria-hidden', 'true'); bellIcon.textContent = '🔔';
  const bellText = document.createElement('span'); bellText.className = 'space-label'; bellText.textContent = 'Notifications';
  const bell = link('', isAdmin ? '/admin/notifications' : '/dashboard/notifications/', 'space-pill', 'Notifications');
  bell.append(bellIcon, bellText);
  const back = link('← Retour au site', '/', 'space-pill space-primary');
  actions.append(home, bell, back);
  bar.append(brand, actions);
  const trust = document.querySelector('.trust-bar');
  if (trust) trust.after(bar); else document.body.prepend(bar);
}

function backdrop() {
  let node = document.querySelector('.space-backdrop');
  if (!node) {
    node = document.createElement('div');
    node.className = 'space-backdrop';
    node.hidden = true;
    node.addEventListener('click', closeMenus);
    document.body.append(node);
  }
  return node;
}

function closeMenus() {
  document.querySelectorAll(`${SIDEBARS}`).forEach(sidebar => sidebar.classList.remove('is-open'));
  document.querySelectorAll(TOGGLES).forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  sync();
}

function sync() {
  const open = [...document.querySelectorAll(SIDEBARS)].some(sidebar => sidebar.classList.contains('is-open'));
  backdrop().hidden = !open || matchMedia('(min-width: 861px)').matches;
  document.body.classList.toggle('client-menu-open', open);
}

function enhance() {
  topbar();
  const sidebar = document.querySelector(SIDEBARS);
  // "Mon espace" is only needed on pages that have no menu of their own.
  const hasMenu = Boolean(document.querySelector(TOGGLES));
  document.querySelector('.space-home')?.classList.toggle('space-hide-mobile', hasMenu || location.pathname === spaceHome());
  document.querySelectorAll(TOGGLES).forEach(toggle => {
    if (toggle.dataset.spaceDone) return;
    toggle.dataset.spaceDone = '1';
    if (/^\s*menu\s*$/i.test(toggle.textContent)) { toggle.textContent = '☰'; toggle.setAttribute('aria-label', 'Ouvrir le menu'); }
    toggle.classList.add('space-menu-btn');
  });
  if (sidebar) {
    document.querySelectorAll(LOGOUTS).forEach(button => {
      if (sidebar.contains(button)) return;
      button.classList.add('space-logout');
      sidebar.append(button); // moving keeps the space's own click handler
    });
  }
  // Header "Notifications" buttons duplicate the top bar bell on phones.
  document.querySelectorAll('.dashboard-header-actions a, .admin-header-actions a').forEach(a => {
    if (/^\s*(Notifications|Retour à l’accueil)\s*$/.test(a.textContent)) a.classList.add('space-hide-mobile');
  });
  document.querySelectorAll(TABLES).forEach(table => {
    if (table.dataset.spaceDone === String(table.rows.length)) return;
    if (table.tBodies[0]?.rows.length > 15) return; // long data grids stay tables, scrolled sideways
    const heads = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(row => [...row.cells].forEach((cell, index) => { if (heads[index]) cell.dataset.label = heads[index]; }));
    table.classList.add('space-cards');
    table.dataset.spaceDone = String(table.rows.length);
  });
  document.querySelectorAll('.dashboard-sidebar .notification-badge, .admin-sidebar .notification-badge, .client-sidebar .notification-badge').forEach(badge => badge.classList.toggle('space-zero', badge.textContent.trim() === '0'));
  groupActions();
  sync();
}

// A row with many buttons keeps the main decisions visible and hides the rest behind
// "Plus d'actions". Buttons are never moved, so each space's own handlers keep working.
const PRIMARY = /^(Accepter|Refuser|Confirmer|Voir|Modifier|Reprendre|Examiner|Ouvrir|Valider)\b/;
function groupActions() {
  document.querySelectorAll('table td, .hotel-row-actions, .vehicle-row-actions, .trip-row-actions').forEach(cell => {
    if (cell.querySelector('.space-more-toggle')) return;
    const buttons = [...cell.querySelectorAll(':scope > button, :scope > a.btn, :scope > div > button, :scope > div > a.btn')];
    if (buttons.length <= 3) return;
    const secondary = buttons.filter(button => !PRIMARY.test(button.textContent.trim()));
    if (secondary.length < 2) return;
    secondary.forEach(button => button.classList.add('space-secondary'));
    const host = buttons[0].parentElement;
    host.classList.add('space-has-more');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'space-more-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Plus d’actions';
    toggle.addEventListener('click', () => {
      const open = host.classList.toggle('space-more-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Moins d’actions' : 'Plus d’actions';
    });
    host.append(toggle);
  });
}

addStyles();
let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; enhance(); });
});
function start() {
  enhance();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
