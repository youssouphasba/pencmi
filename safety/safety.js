const safetyTipsByModule = {
  real_estate: ["Visitez le bien avant tout engagement.", "Vérifiez l’identité de l’annonceur.", "Méfiez-vous des demandes d’argent suspectes."],
  hotels: ["Vérifiez les conditions avant de réserver.", "Confirmez les dates et la disponibilité avec l’établissement.", "Gardez une trace des échanges."],
  vehicles: ["Vérifiez les documents du véhicule.", "Inspectez le véhicule avant paiement.", "Méfiez-vous des prix trop bas."],
  trips: ["Confirmez le lieu et l’heure de départ.", "Gardez le contact du transporteur.", "Évitez les paiements suspects."],
};

function ReportButton(label = 'Signaler') {
  return `<button class="btn btn-ghost" type="button" data-open-report>${label}</button>`;
}

function SafetyTipsBox(module = 'real_estate') {
  const tips = safetyTipsByModule[module] || safetyTipsByModule.real_estate;
  return `<section class="safety-tips-box"><h2>Conseils de sécurité</h2><ul>${tips.map(tip => `<li>${tip}</li>`).join('')}</ul>${ReportButton('Signaler un problème')}</section>`;
}

function bindListingReports(root, module, targetId) {
  const query = new URLSearchParams({ module, targetType: 'listing', targetId });
  root.querySelectorAll('[data-open-report]').forEach(button => {
    const link = document.createElement('a');
    link.className = button.className;
    link.textContent = button.textContent;
    link.href = `/signaler/?${query}`;
    button.replaceWith(link);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#safety-root');
  if (!root) return;
  try {
    const { mountSafetyPage } = await import('./reports-ui.mjs');
    await mountSafetyPage(root, document.body.dataset.safetyPage);
  } catch {
    root.textContent = 'Impossible de charger les signalements. Actualisez la page.';
  }
});
