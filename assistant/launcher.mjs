// Floating "Guindi" button. Opens the conversation in a panel over the current page
// (bottom-right window on large screens, a sheet that leaves the page visible on phones).
// Shown only when the server says the assistant is enabled for this account; silent on any error.
import { publicationRequest, getPublicationApiBase } from '../publier/real-estate-api.mjs';

let panel, frame, launcher;

function styles() {
  const style = document.createElement('style');
  style.textContent = `
    .guindi-launcher { position: fixed; right: 16px; bottom: 16px; z-index: 55; display: inline-flex; align-items: center; gap: 8px;
      min-height: 48px; padding: 0 18px; border: 0; border-radius: 999px; background: #1d4ed8; color: #fff; font: 700 15px/1 Inter, system-ui, sans-serif;
      text-decoration: none; box-shadow: 0 10px 28px rgba(15, 23, 42, .25); cursor: pointer; }
    .guindi-launcher:hover { background: #1e40af; }
    .guindi-launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
    .guindi-launcher span[aria-hidden] { font-size: 18px; }
    body.client-menu-open .guindi-launcher, body.guindi-open .guindi-launcher { display: none; }
    .guindi-panel { position: fixed; z-index: 80; right: 16px; bottom: 16px; width: 400px; height: min(640px, calc(100dvh - 32px));
      overflow: hidden; background: #fff; border-radius: 18px; box-shadow: 0 24px 60px rgba(15, 23, 42, .3);
      transform-origin: bottom right; animation: guindi-in .18s ease-out; }
    .guindi-panel[hidden] { display: none; }
    .guindi-panel iframe { width: 100%; height: 100%; border: 0; display: block; }
    @keyframes guindi-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
    @media (max-width: 600px) {
      .guindi-panel { left: 0; right: 0; bottom: 0; width: 100%; height: 78dvh; border-radius: 18px 18px 0 0; }
    }
    @media (prefers-reduced-motion: reduce) { .guindi-panel { animation: none; } }
    @media print { .guindi-launcher, .guindi-panel { display: none; } }`;
  document.head.append(style);
}

function open() {
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'guindi-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Guindi, l’assistant Péncmi');
    frame = document.createElement('iframe');
    frame.title = 'Guindi';
    frame.src = '/assistant/?embed=1';
    panel.append(frame);
    document.body.append(panel);
  }
  panel.hidden = false;
  document.body.classList.add('guindi-open');
  frame.focus();
}

function close() {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.body.classList.remove('guindi-open');
  launcher?.focus();
}

async function mountGuindiLauncher() {
  if (document.querySelector('.guindi-launcher') || location.pathname.startsWith('/assistant')) return;
  // Only load the API configuration when the page has none of its own.
  if (!getPublicationApiBase()) {
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = '/config/runtime-config.js';
      script.onload = script.onerror = resolve;
      document.head.append(script);
    });
  }
  try {
    const capabilities = await publicationRequest('/assistant/capabilities');
    if (!capabilities?.enabled) return;
  } catch { return; }
  styles();
  launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'guindi-launcher';
  launcher.setAttribute('aria-label', 'Discuter avec Guindi, l’assistant Péncmi');
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '✦';
  launcher.append(icon, document.createTextNode('Guindi'));
  launcher.addEventListener('click', open);
  document.body.append(launcher);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.data === 'guindi:close') close();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void mountGuindiLauncher());
else void mountGuindiLauncher();
