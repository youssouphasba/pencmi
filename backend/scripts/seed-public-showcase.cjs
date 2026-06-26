const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

function loadEnvFile() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile();

const {
  PrismaClient,
  AccountStatus,
  UserRole,
  ProfessionalType,
  ListingStatus,
  RequestStatus,
  ContactSource,
  PencmiModule,
  TargetType,
} = require("@prisma/client");

const prisma = new PrismaClient();

const SEED_KEY = "public-showcase-v1";
const LEGACY_SEED_KEY = "real-estate-demo-v1";

const USERS = {
  agency: {
    email: "agence.immo@pencmi.local",
    password: "AgenceImmoPencmi123!",
    role: UserRole.real_estate_agency,
    firstName: "Awa",
    lastName: "Sarr",
    city: "Dakar",
    profile: {
      businessName: "Teranga Habitat",
      professionalType: ProfessionalType.real_estate_agency,
      city: "Dakar",
      address: "Point E, Dakar",
      description: "Agence immobilière active sur Dakar, Saly et Thiès.",
      professionalPhone: "+221771112233",
      professionalEmail: "agence.immo@pencmi.local",
      whatsappNumber: "+221771112233",
      website: "https://pencmi-production.up.railway.app",
      openingHours: "Lun-Sam 08:30 - 18:30",
      verified: true,
    },
  },
  hotel: {
    email: "hotel.manager@pencmi.local",
    password: "HotelManagerPencmi123!",
    role: UserRole.hotel_manager,
    firstName: "Moussa",
    lastName: "Ndiaye",
    city: "Saly",
    profile: {
      businessName: "Résidence Teranga Saly",
      professionalType: ProfessionalType.hotel,
      city: "Saly",
      address: "Route de Saly, Mbour",
      description: "Établissement avec chambres et appartements meublés à Saly.",
      professionalPhone: "+221771112244",
      professionalEmail: "hotel.manager@pencmi.local",
      whatsappNumber: "+221771112244",
      website: "https://pencmi-production.up.railway.app",
      openingHours: "Tous les jours 08:00 - 22:00",
      verified: true,
    },
  },
  vehicle: {
    email: "voitures.pro@pencmi.local",
    password: "VoituresProPencmi123!",
    role: UserRole.vehicle_renter,
    firstName: "Ibrahima",
    lastName: "Fall",
    city: "Dakar",
    profile: {
      businessName: "Auto Plus Dakar",
      professionalType: ProfessionalType.vehicle_renter,
      city: "Dakar",
      address: "VDN, Dakar",
      description: "Location et vente de véhicules à Dakar.",
      professionalPhone: "+221771112255",
      professionalEmail: "voitures.pro@pencmi.local",
      whatsappNumber: "+221771112255",
      website: "https://pencmi-production.up.railway.app",
      openingHours: "Lun-Dim 09:00 - 20:00",
      verified: true,
    },
  },
  trip: {
    email: "trajets.pro@pencmi.local",
    password: "TrajetsProPencmi123!",
    role: UserRole.transport_provider,
    firstName: "Cheikh",
    lastName: "Ba",
    city: "Dakar",
    profile: {
      businessName: "Teranga Voyages",
      professionalType: ProfessionalType.transport_provider,
      city: "Dakar",
      address: "Colobane, Dakar",
      description: "Trajets interurbains entre Dakar, Touba, Thiès et Saint-Louis.",
      professionalPhone: "+221771112266",
      professionalEmail: "trajets.pro@pencmi.local",
      whatsappNumber: "+221771112266",
      website: "https://pencmi-production.up.railway.app",
      openingHours: "Tous les jours 06:00 - 21:00",
      verified: true,
    },
  },
  client: {
    email: "client.public@pencmi.local",
    password: "ClientPublicPencmi123!",
    role: UserRole.client,
    firstName: "Fatou",
    lastName: "Diop",
    city: "Thiès",
  },
};

const realEstateSeeds = [
  {
    slug: "appartement-meuble-almadies-pencmi",
    title: "Appartement meublé aux Almadies",
    city: "Dakar",
    neighborhood: "Almadies",
    description: "Appartement meublé avec trois chambres, salon lumineux et cuisine équipée.",
    transaction: "location",
    propertyType: "appartement",
    price: 850000,
    metadata: {
      seedKey: SEED_KEY,
      surface: 145,
      bedrooms: 3,
      bathrooms: 2,
      photos: [
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    slug: "villa-familiale-saly-pencmi",
    title: "Villa familiale à Saly",
    city: "Mbour",
    neighborhood: "Saly",
    description: "Villa avec piscine, jardin et dépendance proche de la plage.",
    transaction: "vente",
    propertyType: "villa",
    price: 185000000,
    metadata: {
      seedKey: SEED_KEY,
      surface: 320,
      bedrooms: 4,
      bathrooms: 4,
      photos: [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    },
  },
];

const hotelSeeds = [
  {
    slug: "residence-teranga-saly",
    name: "Résidence Teranga Saly",
    propertyType: "residence",
    city: "Saly",
    region: "Thiès",
    address: "Saly Center, Mbour",
    description: "Résidence avec studios, suites familiales et piscine.",
    metadata: {
      seedKey: SEED_KEY,
      district: "Saly Center",
      stars: 4,
      nightlyPrice: 65000,
      amenities: ["Wi-Fi", "Piscine", "Restaurant", "Climatisation", "Parking"],
      conditions: ["Réservation sans paiement immédiat", "Petit-déjeuner inclus", "Enfants acceptés"],
      photos: [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    },
    rooms: [
      { name: "Studio confort", roomType: "studio", capacity: 2, status: ListingStatus.active },
      { name: "Suite familiale", roomType: "suite", capacity: 4, status: ListingStatus.active },
    ],
  },
  {
    slug: "auberge-saint-louis-centre",
    name: "Auberge Saint-Louis Centre",
    propertyType: "auberge",
    city: "Saint-Louis",
    region: "Saint-Louis",
    address: "Île de Saint-Louis",
    description: "Auberge calme au cœur de la ville avec chambres ventilées et terrasse.",
    metadata: {
      seedKey: SEED_KEY,
      district: "Île",
      stars: 3,
      nightlyPrice: 38000,
      amenities: ["Wi-Fi", "Terrasse", "Petit-déjeuner", "Réception 24h/24"],
      conditions: ["Paiement sur place", "Animaux acceptés"],
      photos: [
        "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
    },
    rooms: [
      { name: "Chambre double", roomType: "double", capacity: 2, status: ListingStatus.active },
    ],
  },
];

const vehicleSeeds = [
  {
    slug: "toyota-prado-location-dakar",
    title: "Toyota Prado à louer à Dakar",
    vehicleMode: "rental",
    city: "Dakar",
    price: 90000,
    description: "SUV climatisé disponible pour location à la journée ou à la semaine.",
    metadata: {
      seedKey: SEED_KEY,
      brand: "Toyota",
      model: "Prado",
      year: 2021,
      fuel: "Diesel",
      gearbox: "Automatique",
      seats: 7,
      category: "SUV",
      mileage: 62000,
      options: ["Climatisation", "Caméra de recul", "Bluetooth", "GPS"],
      documents: ["Carte grise", "Assurance", "Visite technique"],
      conditions: "Caution et pièces d’identité demandées avant remise.",
      photos: [
        "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    slug: "hyundai-tucson-vente-dakar",
    title: "Hyundai Tucson à vendre à Dakar",
    vehicleMode: "sale",
    city: "Dakar",
    price: 16500000,
    description: "SUV bien entretenu avec carnet de maintenance et faible kilométrage.",
    metadata: {
      seedKey: SEED_KEY,
      brand: "Hyundai",
      model: "Tucson",
      year: 2020,
      fuel: "Essence",
      gearbox: "Automatique",
      seats: 5,
      category: "SUV",
      mileage: 54000,
      options: ["Climatisation", "Radar de recul", "Bluetooth"],
      documents: ["Carte grise", "Assurance"],
      conditions: "Visite sur rendez-vous.",
      photos: [
        "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    slug: "mercedes-classe-e-chauffeur-dakar",
    title: "Mercedes Classe E avec chauffeur",
    vehicleMode: "chauffeur",
    city: "Dakar",
    price: 120000,
    description: "Service avec chauffeur pour transferts et rendez-vous professionnels.",
    metadata: {
      seedKey: SEED_KEY,
      brand: "Mercedes-Benz",
      model: "Classe E",
      year: 2022,
      fuel: "Diesel",
      gearbox: "Automatique",
      seats: 4,
      category: "Berline",
      mileage: 28000,
      options: ["Climatisation", "Cuir", "Bluetooth"],
      documents: ["Assurance", "Permis professionnel"],
      conditions: "Réservation au moins 12 heures à l’avance.",
      photos: [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
      ],
      coverPhoto: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    },
  },
];

const tripSeeds = [
  {
    slug: "dakar-touba-bus-matin",
    title: "Dakar → Touba départ matinal",
    vehicleType: "bus",
    departureCity: "Dakar",
    arrivalCity: "Touba",
    departurePoint: "Colobane",
    arrivalPoint: "Gare routière de Touba",
    departureDate: "2026-07-01T00:00:00.000Z",
    departureTime: "07:00",
    pricePerSeat: 7000,
    availableSeats: 18,
    metadata: {
      seedKey: SEED_KEY,
      transporterName: "Teranga Voyages",
      estimatedArrivalTime: "10:45",
      estimatedDuration: "3h45",
      vehicleLabel: "Bus climatisé 40 places",
      luggageAllowed: true,
      largeLuggageAllowed: true,
      airConditioning: true,
      directTrip: true,
      conditions: ["Bagages acceptés", "Paiement sur place", "Départ direct"],
      description: "Départ ponctuel le matin depuis Dakar vers Touba.",
      coverPhoto: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80",
    },
  },
  {
    slug: "dakar-saint-louis-minibus",
    title: "Dakar → Saint-Louis en minibus",
    vehicleType: "minibus",
    departureCity: "Dakar",
    arrivalCity: "Saint-Louis",
    departurePoint: "Patte d’Oie",
    arrivalPoint: "Pont Faidherbe",
    departureDate: "2026-07-02T00:00:00.000Z",
    departureTime: "14:30",
    pricePerSeat: 9500,
    availableSeats: 9,
    metadata: {
      seedKey: SEED_KEY,
      transporterName: "Teranga Voyages",
      estimatedArrivalTime: "19:00",
      estimatedDuration: "4h30",
      vehicleLabel: "Minibus récent",
      luggageAllowed: true,
      largeLuggageAllowed: false,
      airConditioning: true,
      directTrip: false,
      conditions: ["Bagages acceptés", "Arrêts limités", "Réservation sans paiement immédiat"],
      description: "Trajet vers Saint-Louis avec arrêts limités.",
      coverPhoto: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80",
    },
  },
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function isTruthy(value) {
  return value === true || value === "true";
}

async function upsertUser(seed) {
  const passwordHash = await bcrypt.hash(seed.password, 12);
  const normalizedEmail = seed.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const data = {
    role: seed.role,
    status: AccountStatus.active,
    firstName: seed.firstName,
    lastName: seed.lastName,
    city: seed.city,
    email: normalizedEmail,
    passwordHash,
    emailVerified: true,
    professionalVerified: Boolean(seed.profile?.verified),
  };

  return existing
    ? prisma.user.update({ where: { id: existing.id }, data })
    : prisma.user.create({ data });
}

async function upsertProfile(userId, profile) {
  if (!profile) return null;
  return prisma.professionalProfile.upsert({
    where: { userId },
    create: { userId, ...profile },
    update: profile,
  });
}

async function upsertRealEstate(ownerUserId, seed) {
  const existing = await prisma.realEstateListing.findUnique({ where: { slug: seed.slug }, select: { id: true } });
  const data = {
    ownerUserId,
    status: ListingStatus.active,
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    transaction: seed.transaction,
    propertyType: seed.propertyType,
    city: seed.city,
    neighborhood: seed.neighborhood,
    price: seed.price,
    currency: "FCFA",
    metadata: seed.metadata,
  };
  return existing
    ? prisma.realEstateListing.update({ where: { id: existing.id }, data })
    : prisma.realEstateListing.create({ data });
}

async function upsertHotel(ownerUserId, seed) {
  const existing = await prisma.hotelProperty.findUnique({ where: { slug: seed.slug }, select: { id: true } });
  const property = existing
    ? await prisma.hotelProperty.update({
        where: { id: existing.id },
        data: {
          ownerUserId,
          status: ListingStatus.active,
          name: seed.name,
          propertyType: seed.propertyType,
          city: seed.city,
          region: seed.region,
          address: seed.address,
          description: seed.description,
          contactSettings: { seedKey: SEED_KEY },
        },
      })
    : await prisma.hotelProperty.create({
        data: {
          ownerUserId,
          status: ListingStatus.active,
          slug: seed.slug,
          name: seed.name,
          propertyType: seed.propertyType,
          city: seed.city,
          region: seed.region,
          address: seed.address,
          description: seed.description,
          contactSettings: { seedKey: SEED_KEY },
        },
      });

  await prisma.hotelProperty.update({
    where: { id: property.id },
    data: { description: seed.description, contactSettings: seed.metadata },
  });

  await prisma.hotelRoom.deleteMany({ where: { propertyId: property.id } });
  for (const room of seed.rooms) {
    await prisma.hotelRoom.create({ data: { propertyId: property.id, ...room } });
  }
  return property;
}

async function upsertVehicle(ownerUserId, seed) {
  const existing = await prisma.vehicleListing.findUnique({ where: { slug: seed.slug }, select: { id: true } });
  const data = {
    ownerUserId,
    status: ListingStatus.active,
    slug: seed.slug,
    title: seed.title,
    description: seed.description,
    vehicleMode: seed.vehicleMode,
    city: seed.city,
    price: seed.price,
    currency: "FCFA",
    metadata: seed.metadata,
  };
  return existing
    ? prisma.vehicleListing.update({ where: { id: existing.id }, data })
    : prisma.vehicleListing.create({ data });
}

async function upsertTrip(ownerUserId, seed) {
  const existing = await prisma.tripListing.findUnique({ where: { slug: seed.slug }, select: { id: true } });
  const data = {
    ownerUserId,
    status: ListingStatus.active,
    slug: seed.slug,
    title: seed.title,
    vehicleType: seed.vehicleType,
    departureCity: seed.departureCity,
    arrivalCity: seed.arrivalCity,
    departurePoint: seed.departurePoint,
    arrivalPoint: seed.arrivalPoint,
    departureDate: new Date(seed.departureDate),
    departureTime: seed.departureTime,
    pricePerSeat: seed.pricePerSeat,
    currency: "FCFA",
    availableSeats: seed.availableSeats,
    metadata: seed.metadata,
  };
  return existing
    ? prisma.tripListing.update({ where: { id: existing.id }, data })
    : prisma.tripListing.create({ data });
}

async function createShowcaseFlows(clientUserId, hotelId, vehicleIds, tripId, realEstateId) {
  await prisma.realEstateVisitRequest.deleteMany({ where: { listingId: realEstateId, clientEmail: USERS.client.email } });
  await prisma.hotelReservationRequest.deleteMany({ where: { propertyId: hotelId, clientEmail: USERS.client.email } });
  await prisma.vehicleRentalRequest.deleteMany({ where: { listingId: vehicleIds.rental, clientEmail: USERS.client.email } });
  await prisma.vehicleChauffeurRequest.deleteMany({ where: { listingId: vehicleIds.chauffeur, clientEmail: USERS.client.email } });
  await prisma.tripSeatRequest.deleteMany({ where: { tripId, clientEmail: USERS.client.email } });

  await prisma.realEstateVisitRequest.create({
    data: {
      listingId: realEstateId,
      clientUserId,
      clientName: "Fatou Diop",
      clientPhone: "+221770000001",
      clientEmail: USERS.client.email,
      preferredDate: new Date("2026-07-03T10:00:00.000Z"),
      message: "Je souhaite visiter ce bien cette semaine.",
      status: RequestStatus.new,
    },
  });

  await prisma.hotelReservationRequest.create({
    data: {
      propertyId: hotelId,
      clientUserId,
      clientName: "Fatou Diop",
      clientPhone: "+221770000001",
      clientEmail: USERS.client.email,
      checkIn: new Date("2026-07-10T00:00:00.000Z"),
      checkOut: new Date("2026-07-12T00:00:00.000Z"),
      guests: 2,
      message: "Je souhaite réserver pour deux personnes.",
      status: RequestStatus.new,
    },
  });

  await prisma.vehicleRentalRequest.create({
    data: {
      listingId: vehicleIds.rental,
      clientUserId,
      clientName: "Fatou Diop",
      clientPhone: "+221770000001",
      clientEmail: USERS.client.email,
      startDate: new Date("2026-07-05T00:00:00.000Z"),
      endDate: new Date("2026-07-08T00:00:00.000Z"),
      message: "Je souhaite louer ce véhicule pour trois jours.",
      status: RequestStatus.new,
    },
  });

  await prisma.vehicleChauffeurRequest.create({
    data: {
      listingId: vehicleIds.chauffeur,
      clientUserId,
      clientName: "Fatou Diop",
      clientPhone: "+221770000001",
      clientEmail: USERS.client.email,
      pickupCity: "Dakar",
      destinationCity: "Saly",
      serviceDate: new Date("2026-07-06T00:00:00.000Z"),
      message: "J’ai besoin d’un chauffeur pour un déplacement aller-retour.",
      status: RequestStatus.new,
    },
  });

  await prisma.tripSeatRequest.create({
    data: {
      tripId,
      clientUserId,
      clientName: "Fatou Diop",
      clientPhone: "+221770000001",
      clientEmail: USERS.client.email,
      requestedSeats: 2,
      luggage: true,
      message: "Je souhaite réserver deux places avec bagages.",
      status: RequestStatus.new,
    },
  });

  await prisma.contactEvent.createMany({
    data: [
      { module: PencmiModule.real_estate, source: ContactSource.visit_request, targetType: TargetType.listing, targetId: realEstateId, clientUserId, metadata: { seedKey: SEED_KEY } },
      { module: PencmiModule.hotels, source: ContactSource.reservation_request, targetType: TargetType.listing, targetId: hotelId, clientUserId, metadata: { seedKey: SEED_KEY } },
      { module: PencmiModule.vehicles, source: ContactSource.rental_request, targetType: TargetType.listing, targetId: vehicleIds.rental, clientUserId, metadata: { seedKey: SEED_KEY } },
      { module: PencmiModule.vehicles, source: ContactSource.chauffeur_request, targetType: TargetType.listing, targetId: vehicleIds.chauffeur, clientUserId, metadata: { seedKey: SEED_KEY } },
      { module: PencmiModule.trips, source: ContactSource.seat_request, targetType: TargetType.listing, targetId: tripId, clientUserId, metadata: { seedKey: SEED_KEY } },
    ],
  });
}

async function cleanup() {
  const managedEmails = [
    USERS.agency.email,
    USERS.hotel.email,
    USERS.vehicle.email,
    USERS.trip.email,
    USERS.client.email,
    "demo.agence.immo@pencmi.local",
    "demo.client@pencmi.local",
  ];

  const managedUserIds = (
    await prisma.user.findMany({
      where: { email: { in: managedEmails } },
      select: { id: true },
    })
  ).map((item) => item.id);

  await prisma.contactEvent.deleteMany({
    where: {
      OR: [
        { metadata: { path: ["seedKey"], equals: SEED_KEY } },
        { metadata: { path: ["seedKey"], equals: LEGACY_SEED_KEY } },
        ...(managedUserIds.length ? [{ clientUserId: { in: managedUserIds } }] : []),
      ],
    },
  });

  await prisma.tripSeatRequest.deleteMany({ where: { clientEmail: { in: [USERS.client.email, "demo.client@pencmi.local"] } } });
  await prisma.vehicleChauffeurRequest.deleteMany({ where: { clientEmail: { in: [USERS.client.email, "demo.client@pencmi.local"] } } });
  await prisma.vehicleRentalRequest.deleteMany({ where: { clientEmail: { in: [USERS.client.email, "demo.client@pencmi.local"] } } });
  await prisma.hotelReservationRequest.deleteMany({ where: { clientEmail: { in: [USERS.client.email, "demo.client@pencmi.local"] } } });
  await prisma.realEstateVisitRequest.deleteMany({ where: { clientEmail: { in: [USERS.client.email, "demo.client@pencmi.local"] } } });

  await prisma.hotelRoom.deleteMany({ where: { property: { ownerUserId: { in: managedUserIds } } } });
  await prisma.tripListing.deleteMany({ where: { OR: [{ ownerUserId: { in: managedUserIds } }, { metadata: { path: ["seedKey"], equals: SEED_KEY } }] } });
  await prisma.vehicleListing.deleteMany({ where: { OR: [{ ownerUserId: { in: managedUserIds } }, { metadata: { path: ["seedKey"], equals: SEED_KEY } }] } });
  await prisma.hotelProperty.deleteMany({ where: { OR: [{ ownerUserId: { in: managedUserIds } }, { contactSettings: { path: ["seedKey"], equals: SEED_KEY } }] } });
  await prisma.realEstateListing.deleteMany({
    where: {
      OR: [
        { ownerUserId: { in: managedUserIds } },
        { metadata: { path: ["seedKey"], equals: SEED_KEY } },
        { metadata: { path: ["seedKey"], equals: LEGACY_SEED_KEY } },
      ],
    },
  });

  await prisma.message.deleteMany({ where: { senderUserId: { in: managedUserIds } } });
  await prisma.conversationParticipant.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.savedAlert.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.supportTicket.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: managedUserIds } } });
  await prisma.report.deleteMany({ where: { reporterUserId: { in: managedUserIds } } });

  await prisma.professionalProfile.deleteMany({ where: { userId: { in: managedUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: managedUserIds } } });
}

async function seed() {
  const agencyUser = await upsertUser(USERS.agency);
  const hotelUser = await upsertUser(USERS.hotel);
  const vehicleUser = await upsertUser(USERS.vehicle);
  const tripUser = await upsertUser(USERS.trip);
  const clientUser = await upsertUser(USERS.client);

  await upsertProfile(agencyUser.id, USERS.agency.profile);
  await upsertProfile(hotelUser.id, USERS.hotel.profile);
  await upsertProfile(vehicleUser.id, USERS.vehicle.profile);
  await upsertProfile(tripUser.id, USERS.trip.profile);

  const realEstateListings = [];
  for (const item of realEstateSeeds) {
    realEstateListings.push(await upsertRealEstate(agencyUser.id, item));
  }

  const hotelListings = [];
  for (const item of hotelSeeds) {
    hotelListings.push(await upsertHotel(hotelUser.id, item));
  }

  const vehicleListings = [];
  for (const item of vehicleSeeds) {
    vehicleListings.push(await upsertVehicle(vehicleUser.id, item));
  }

  const tripListings = [];
  for (const item of tripSeeds) {
    tripListings.push(await upsertTrip(tripUser.id, item));
  }

  await createShowcaseFlows(
    clientUser.id,
    hotelListings[0].id,
    {
      rental: vehicleListings.find((item) => item.vehicleMode === "rental")?.id,
      chauffeur: vehicleListings.find((item) => item.vehicleMode === "chauffeur")?.id,
    },
    tripListings[0].id,
    realEstateListings[0].id,
  );

  return {
    users: {
      agency: { email: USERS.agency.email, password: USERS.agency.password },
      hotel: { email: USERS.hotel.email, password: USERS.hotel.password },
      vehicle: { email: USERS.vehicle.email, password: USERS.vehicle.password },
      trip: { email: USERS.trip.email, password: USERS.trip.password },
      client: { email: USERS.client.email, password: USERS.client.password },
    },
    counts: {
      realEstate: realEstateListings.length,
      hotels: hotelListings.length,
      vehicles: vehicleListings.length,
      trips: tripListings.length,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const shouldCleanup = isTruthy(args.cleanup);

  if (shouldCleanup) {
    await cleanup();
    console.log("Les données de vitrine ont été supprimées.");
    return;
  }

  await cleanup();
  const result = await seed();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
