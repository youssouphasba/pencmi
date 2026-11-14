// Thin bar at the very top of every page: safety advice, anti-scam tips and publishing rules.
const LINKS = [
  ['🛡️', 'Sécurité', '/securite/'],
  ['⚠️', 'Anti-arnaque', '/conseils-anti-arnaque/'],
  ['📋', 'Règles de publication', '/regles-publication/', 'Règles'],
];

function mountTrustBar() {
  if (document.querySelector('.trust-bar') || window.self !== window.top) return;
  const style = document.createElement('style');
  style.textContent = `
    .trust-bar { display: flex; justify-content: center; gap: 8px; padding: 6px 12px; overflow-x: auto; scrollbar-width: none;
      background: #eef4ff; border-bottom: 1px solid #d6e3fb; font: 600 13px/1.2 Inter, system-ui, sans-serif; }
    .trust-bar::-webkit-scrollbar { display: none; }
    .trust-bar a { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; min-height: 30px; padding: 0 10px 0 9px;
      color: #1d4ed8; background: #fff; border: 1px solid #bcd0f5; border-radius: 999px; box-shadow: 0 1px 2px rgba(15, 42, 95, .08);
      text-decoration: none; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s; }
    .trust-bar a::after { content: "›"; font-size: 15px; line-height: 1; color: #6b8fd6; }
    .trust-bar a:hover { background: #f5f8ff; border-color: #1d4ed8; }
    .trust-bar a[aria-current="page"] { color: #fff; background: #1d4ed8; border-color: #1d4ed8; }
    .trust-bar a[aria-current="page"]::after { color: #fff; }
    .trust-bar a:focus-visible { outline: 3px solid #93c5fd; outline-offset: 1px; }
    .trust-short { display: none; }
    @media (max-width: 440px) { .trust-full { display: none; } .trust-short { display: inline; } .trust-bar { gap: 6px; } }
    @media print { .trust-bar { display: none; } }`;
  document.head.append(style);
  const bar = document.createElement('nav');
  bar.className = 'trust-bar';
  bar.setAttribute('aria-label', 'Sécurité et règles');
  const here = location.pathname.replace(/\/?$/, '/');
  for (const [icon, label, href, short] of LINKS) {
    const link = document.createElement('a');
    link.href = href;
    if (here === href) link.setAttribute('aria-current', 'page');
    const mark = document.createElement('span');
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = icon;
    link.append(mark);
    if (short) {
      link.setAttribute('aria-label', label);
      const full = document.createElement('span'); full.className = 'trust-full'; full.textContent = label;
      const brief = document.createElement('span'); brief.className = 'trust-short'; brief.textContent = short;
      link.append(full, brief);
    } else link.append(document.createTextNode(label));
    bar.append(link);
  }
  document.body.prepend(bar);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountTrustBar);
else mountTrustBar();
