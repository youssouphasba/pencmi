export const tripTypes = {
  bus: "Bus",
  car: "Car",
  minibus: "Minibus",
  sept_places: "Véhicule 7 places",
  voiture_particuliere: "Voiture particulière",
  covoiturage: "Covoiturage",
  vehicule_avec_chauffeur: "Véhicule avec chauffeur",
};
export const tripStatuses = {
  draft: "Brouillon",
  pending_review: "En attente de validation",
  active: "Actif",
  refused: "Refusé",
  suspended: "Suspendu",
  expired: "Expiré",
  deleted: "Supprimé",
};
export const tripSteps = [
  "Type de trajet",
  "Départ et arrivée",
  "Date et horaires",
  "Véhicule",
  "Places et prix",
  "Conditions",
  "Description",
  "Moyens de contact",
  "Prévisualisation",
  "Soumission",
];
export const tripConditions = [
  "Bagages acceptés",
  "Gros bagages acceptés",
  "Enfants acceptés",
  "Animaux acceptés",
  "Non-fumeur",
  "Départ direct",
  "Arrêts limités",
  "Annulation possible",
  "Paiement sur place",
];
export const tripCopy = {
  recurrenceUnavailable:
    "Les trajets réguliers ne sont pas disponibles. Publiez un départ daté.",
  submitted: "Votre trajet est en attente de validation.",
  saved: "Brouillon enregistré.",
  declaredSeats: "Places déclarées, à confirmer avec le transporteur.",
  requestReceived:
    "Votre demande a été reçue. Elle ne constitue pas une réservation confirmée.",
};
export const tripEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function emptyTripDraft() {
  return {
    route: {},
    schedule: { regular: false },
    vehicle: {},
    pricing: { currency: "FCFA" },
    conditions: [],
    content: {},
    contactPreferences: { reservationRequestEnabled: true },
  };
}
export function tripDraftFromListing(row) {
  const p = row.publication || row.metadata?.publication || {},
    draft = emptyTripDraft();
  for (const section of [
    "route",
    "schedule",
    "vehicle",
    "pricing",
    "content",
    "contactPreferences",
  ])
    draft[section] = { ...draft[section], ...p[section] };
  draft.vehicleType = p.vehicleType || undefined;
  draft.conditions = p.conditions || [];
  return draft;
}
export function tripFieldStep(path) {
  return (
    {
      vehicleType: 0,
      route: 1,
      schedule: 2,
      vehicle: 3,
      pricing: 4,
      conditions: 5,
      content: 6,
      contactPreferences: 7,
    }[path.split(".")[0]] ?? 0
  );
}
