export const vehicleSteps = [
  'Type d’annonce',
  'Marque et modèle',
  'Informations véhicule',
  'Localisation',
  'Prix',
  'Photos',
  'Équipements',
  'Documents',
  'Description',
  'Moyens de contact',
  'Prévisualisation',
  'Soumission',
];
export const vehicleChoices = {
  brand: [
    'Toyota',
    'Hyundai',
    'Kia',
    'Peugeot',
    'Renault',
    'Mercedes-Benz',
    'BMW',
    'Audi',
    'Volkswagen',
    'Ford',
    'Nissan',
    'Mitsubishi',
    'Suzuki',
    'Honda',
    'Chevrolet',
    'Citroën',
    'Dacia',
    'Land Rover',
    'Lexus',
    'Mazda',
    'Opel',
    'Fiat',
    'Jeep',
    'Autre',
  ],
  fuel: ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL'],
  gearbox: ['Manuelle', 'Automatique'],
  category: [
    'Citadine',
    'Berline',
    'SUV',
    '4x4',
    'Pick-up',
    'Monospace',
    'Utilitaire',
    'Camion',
    'Bus',
    'Minibus',
    'Moto',
    'Autre',
  ],
  condition: [
    'Neuf',
    'Occasion',
    'Importé',
    'Déjà immatriculé au Sénégal',
    'À dédouaner',
  ],
  equipment: [
    'Climatisation',
    'Caméra de recul',
    'Radar de recul',
    'GPS',
    'Bluetooth',
    'Cuir',
    'Toit ouvrant',
    'Jantes aluminium',
    '4 roues motrices',
    'Airbags',
    'ABS',
  ],
  documents: [
    'Carte grise',
    'Assurance',
    'Visite technique',
    'Dédouanement',
    'Carnet d’entretien',
    'Facture disponible',
  ],
};
export function emptyVehicleDraft() {
  return {
    title: '',
    description: '',
    vehicleMode: undefined,
    metadata: {
      identity: {},
      info: {},
      location: {},
      pricing: { currency: 'FCFA', chauffeurPriceUnit: 'trip' },
      equipment: [],
      documents: [],
      conditions: '',
      contactPreferences: { contactFormEnabled: true },
    },
  };
}
export function vehicleDraftFromListing(listing) {
  const defaults = emptyVehicleDraft(),
    saved = listing.publication || listing.metadata?.publication || {};
  const metadata = { ...defaults.metadata, ...saved };
  for (const key of [
    'identity',
    'info',
    'location',
    'pricing',
    'contactPreferences',
  ])
    metadata[key] = { ...defaults.metadata[key], ...saved[key] };
  return {
    title: listing.title || '',
    description: listing.description || '',
    vehicleMode: listing.vehicleMode || undefined,
    metadata,
  };
}
export function vehicleFieldStep(path) {
  if (path === 'vehicleMode') return 0;
  if (['title', 'description'].includes(path)) return 8;
  return (
    {
      identity: 1,
      info: 2,
      location: 3,
      pricing: 4,
      photos: 5,
      equipment: 6,
      documents: 7,
      conditions: 8,
      contactPreferences: 9,
    }[path.replace(/^metadata\./, '').split('.')[0]] ?? 0
  );
}
