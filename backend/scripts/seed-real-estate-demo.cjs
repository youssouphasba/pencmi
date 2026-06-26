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
  PencmiModule,
  FileVisibility,
  TargetType,
  RequestStatus,
  ContactSource,
  NotificationPriority,
  NotificationStatus,
} = require("@prisma/client");

const prisma = new PrismaClient();

const DEMO_SEED_KEY = "real-estate-demo-v1";
const AGENCY_EMAIL = "demo.agence.immo@pencmi.local";
const AGENCY_PASSWORD = "DemoAgencePencmi123!";
const CLIENT_EMAIL = "demo.client@pencmi.local";
const CLIENT_PASSWORD = "DemoClientPencmi123!";

const agencyProfileData = {
  businessName: "Teranga Habitat",
  professionalType: ProfessionalType.real_estate_agency,
  city: "Dakar",
  address: "Point E, Dakar",
  description: "Agence immobilière de démonstration pour valider le flux Péncmi.",
  professionalPhone: "+221771112233",
  professionalEmail: AGENCY_EMAIL,
  whatsappNumber: "+221771112233",
  website: "https://pencmi-production.up.railway.app",
  openingHours: "Lun-Sam 08:30 - 18:30",
};

const listingSeeds = [
  {
    slug: "demo-appartement-almadies-pencmi",
    title: "Appartement meublé de démonstration aux Almadies",
    city: "Dakar",
    neighborhood: "Almadies",
    description: "Annonce de démonstration pour vérifier le parcours public, annonceur et admin.",
    transaction: "location",
    propertyType: "appartement",
    price: 850000,
    status: ListingStatus.active,
    currency: "FCFA",
    photos: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    ],
    surface: 145,
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    slug: "demo-villa-saly-pencmi",
    title: "Villa familiale de démonstration à Saly",
    city: "Mbour",
    neighborhood: "Saly",
    description: "Deuxième annonce de démonstration avec photos et statut actif.",
    transaction: "vente",
    propertyType: "villa",
    price: 185000000,
    status: ListingStatus.active,
    currency: "FCFA",
    photos: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
    ],
    surface: 320,
    bedrooms: 4,
    bathrooms: 4,
  },
  {
    slug: "demo-terrain-thies-pencmi",
    title: "Terrain de démonstration à Thiès",
    city: "Thiès",
    neighborhood: "Keur Mame El Hadji",
    description: "Annonce terrain de démonstration pour tester les états d’inventaire.",
    transaction: "vente",
    propertyType: "terrain",
    price: 32000000,
    status: ListingStatus.pending_review,
    currency: "FCFA",
    photos: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
    ],
    surface: 600,
    bedrooms: 0,
    bathrooms: 0,
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

async function upsertUserByEmail({ email, password, role, firstName, lastName, city }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        role,
        status: AccountStatus.active,
        firstName,
        lastName,
        city,
        email: normalizedEmail,
        passwordHash,
      },
    });
  }

  return prisma.user.create({
    data: {
      role,
      status: AccountStatus.active,
      firstName,
      lastName,
      city,
      email: normalizedEmail,
      passwordHash,
      emailVerified: true,
    },
  });
}

async function upsertListing(ownerUserId, seed) {
  const metadata = {
    seedKey: DEMO_SEED_KEY,
    surface: seed.surface,
    bedrooms: seed.bedrooms,
    bathrooms: seed.bathrooms,
    photos: seed.photos,
    coverPhoto: seed.photos[0] || null,
  };

  const existing = await prisma.realEstateListing.findUnique({
    where: { slug: seed.slug },
    select: { id: true },
  });

  if (existing) {
    return prisma.realEstateListing.update({
      where: { id: existing.id },
      data: {
        ownerUserId,
        status: seed.status,
        title: seed.title,
        city: seed.city,
        neighborhood: seed.neighborhood,
        description: seed.description,
        transaction: seed.transaction,
        propertyType: seed.propertyType,
        price: seed.price,
        currency: seed.currency,
        metadata,
      },
    });
  }

  return prisma.realEstateListing.create({
    data: {
      ownerUserId,
      status: seed.status,
      slug: seed.slug,
      title: seed.title,
      city: seed.city,
      neighborhood: seed.neighborhood,
      description: seed.description,
      transaction: seed.transaction,
      propertyType: seed.propertyType,
      price: seed.price,
      currency: seed.currency,
      metadata,
    },
  });
}

async function upsertListingFiles(ownerUserId, listing, photoUrls) {
  await prisma.fileUsage.deleteMany({
    where: {
      targetType: TargetType.listing,
      targetId: listing.id,
    },
  });

  for (let index = 0; index < photoUrls.length; index += 1) {
    const publicUrl = photoUrls[index];
    const storageKey = `${DEMO_SEED_KEY}/${listing.slug}/photo-${index + 1}.jpg`;
    const existingFile = await prisma.fileAsset.findFirst({
      where: { storageKey },
      select: { id: true },
    });
    const file = existingFile
      ? await prisma.fileAsset.update({
          where: { id: existingFile.id },
          data: {
            ownerUserId,
            module: PencmiModule.real_estate,
            visibility: FileVisibility.public,
            mimeType: "image/jpeg",
            sizeBytes: 0,
            publicUrl,
            metadata: {
              seedKey: DEMO_SEED_KEY,
              listingSlug: listing.slug,
              order: index + 1,
            },
          },
        })
      : await prisma.fileAsset.create({
          data: {
            ownerUserId,
            module: PencmiModule.real_estate,
            visibility: FileVisibility.public,
            mimeType: "image/jpeg",
            sizeBytes: 0,
            storageKey,
            publicUrl,
            metadata: {
              seedKey: DEMO_SEED_KEY,
              listingSlug: listing.slug,
              order: index + 1,
            },
          },
        });

    await prisma.fileUsage.create({
      data: {
        fileId: file.id,
        targetType: TargetType.listing,
        targetId: listing.id,
      },
    });
  }
}

async function ensureConversation(agencyUserId, clientUserId, listing) {
  const existing = await prisma.conversation.findFirst({
    where: {
      module: PencmiModule.real_estate,
      targetType: TargetType.listing,
      targetId: listing.id,
    },
    select: { id: true },
  });

  const conversation = existing
    ? await prisma.conversation.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      })
    : await prisma.conversation.create({
        data: {
          module: PencmiModule.real_estate,
          targetType: TargetType.listing,
          targetId: listing.id,
        },
      });

  for (const userId of [agencyUserId, clientUserId]) {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: conversation.id,
        userId,
      },
      select: { id: true },
    });

    if (!participant) {
      await prisma.conversationParticipant.create({
        data: {
          conversationId: conversation.id,
          userId,
        },
      });
    }
  }

  const existingMessage = await prisma.message.findFirst({
    where: {
      conversationId: conversation.id,
      body: {
        contains: DEMO_SEED_KEY,
      },
    },
    select: { id: true },
  });

  if (!existingMessage) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: clientUserId,
        body: `Bonjour, je souhaite organiser une visite pour cette annonce. ${DEMO_SEED_KEY}`,
        attachmentIds: [],
      },
    });
  }

  return conversation;
}

async function ensureVisitRequest(listingId) {
  const existing = await prisma.realEstateVisitRequest.findFirst({
    where: {
      listingId,
      clientEmail: CLIENT_EMAIL,
      message: {
        contains: DEMO_SEED_KEY,
      },
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.realEstateVisitRequest.create({
    data: {
      listingId,
      clientName: "Client Démo",
      clientPhone: "+221770009900",
      clientEmail: CLIENT_EMAIL,
      preferredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      message: `Demande de visite de démonstration ${DEMO_SEED_KEY}`,
      status: RequestStatus.new,
    },
  });
}

async function ensureContactEvent(agencyUserId, clientUserId, listingId, conversationId, visitRequestId) {
  const existing = await prisma.contactEvent.findFirst({
    where: {
      module: PencmiModule.real_estate,
      targetId: listingId,
      source: ContactSource.internal_message,
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.contactEvent.create({
      data: {
        module: PencmiModule.real_estate,
        source: ContactSource.internal_message,
        targetType: TargetType.listing,
        targetId: listingId,
        ownerUserId: agencyUserId,
        clientUserId,
        metadata: {
          seedKey: DEMO_SEED_KEY,
          conversationId,
        },
      },
    });
  }

  const visitEvent = await prisma.contactEvent.findFirst({
    where: {
      module: PencmiModule.real_estate,
      targetId: listingId,
      source: ContactSource.visit_request,
    },
    select: { id: true },
  });

  if (!visitEvent) {
    await prisma.contactEvent.create({
      data: {
        module: PencmiModule.real_estate,
        source: ContactSource.visit_request,
        targetType: TargetType.listing,
        targetId: listingId,
        ownerUserId: agencyUserId,
        clientUserId,
        metadata: {
          seedKey: DEMO_SEED_KEY,
          visitRequestId,
        },
      },
    });
  }
}

async function ensureNotification(userId, title, message, targetUrl) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      title,
      message,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.notification.create({
    data: {
      userId,
      module: PencmiModule.real_estate,
      type: "demo_seed",
      priority: NotificationPriority.normal,
      status: NotificationStatus.unread,
      title,
      message,
      targetUrl,
      metadata: {
        seedKey: DEMO_SEED_KEY,
      },
    },
  });
}

async function cleanupDemoData() {
  const listings = await prisma.realEstateListing.findMany({
    where: {
      OR: [
        { slug: { startsWith: "demo-" } },
        { metadata: { path: ["seedKey"], equals: DEMO_SEED_KEY } },
      ],
    },
    select: { id: true },
  });
  const listingIds = listings.map((listing) => listing.id);

  await prisma.$transaction(async (tx) => {
    if (listingIds.length) {
      await tx.fileUsage.deleteMany({
        where: {
          targetType: TargetType.listing,
          targetId: { in: listingIds },
        },
      });
      await tx.fileAsset.deleteMany({
        where: {
          storageKey: { startsWith: `${DEMO_SEED_KEY}/` },
        },
      });
      await tx.realEstateVisitRequest.deleteMany({
        where: {
          listingId: { in: listingIds },
        },
      });
      await tx.contactEvent.deleteMany({
        where: {
          targetId: { in: listingIds },
        },
      });
      await tx.notification.deleteMany({
        where: {
          metadata: {
            path: ["seedKey"],
            equals: DEMO_SEED_KEY,
          },
        },
      });
      const conversations = await tx.conversation.findMany({
        where: {
          module: PencmiModule.real_estate,
          targetType: TargetType.listing,
          targetId: { in: listingIds },
        },
        select: { id: true },
      });
      const conversationIds = conversations.map((conversation) => conversation.id);
      if (conversationIds.length) {
        await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversationParticipant.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      }
      await tx.realEstateListing.deleteMany({
        where: {
          id: { in: listingIds },
        },
      });
    }

    await tx.professionalProfile.deleteMany({
      where: {
        user: {
          email: AGENCY_EMAIL,
        },
      },
    });
    await tx.user.deleteMany({
      where: {
        email: { in: [AGENCY_EMAIL, CLIENT_EMAIL] },
      },
    });
  });

  console.log("Données de démonstration supprimées.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (isTruthy(args.cleanup)) {
    await cleanupDemoData();
    return;
  }

  const agencyPassword = String(args["agency-password"] || AGENCY_PASSWORD);
  const clientPassword = String(args["client-password"] || CLIENT_PASSWORD);

  const agencyUser = await upsertUserByEmail({
    email: AGENCY_EMAIL,
    password: agencyPassword,
    role: UserRole.real_estate_agency,
    firstName: "Aminata",
    lastName: "Sarr",
    city: "Dakar",
  });

  await prisma.professionalProfile.upsert({
    where: { userId: agencyUser.id },
    update: agencyProfileData,
    create: {
      userId: agencyUser.id,
      ...agencyProfileData,
    },
  });

  const clientUser = await upsertUserByEmail({
    email: CLIENT_EMAIL,
    password: clientPassword,
    role: UserRole.client,
    firstName: "Client",
    lastName: "Démo",
    city: "Dakar",
  });

  const createdListings = [];

  for (const listingSeed of listingSeeds) {
    const listing = await upsertListing(agencyUser.id, listingSeed);
    await upsertListingFiles(agencyUser.id, listing, listingSeed.photos);
    createdListings.push(listing);
  }

  const mainListing = createdListings.find((listing) => listing.status === ListingStatus.active) || createdListings[0];
  const visitRequest = await ensureVisitRequest(mainListing.id);
  const conversation = await ensureConversation(agencyUser.id, clientUser.id, mainListing);
  await ensureContactEvent(agencyUser.id, clientUser.id, mainListing.id, conversation.id, visitRequest.id);
  await ensureNotification(
    agencyUser.id,
    "Nouvelle demande de visite",
    "Une demande de visite de démonstration a été créée sur votre annonce.",
    `/dashboard/immobilier/visites?listing=${mainListing.id}`,
  );

  const summary = {
    seedKey: DEMO_SEED_KEY,
    agency: {
      email: AGENCY_EMAIL,
      password: agencyPassword,
      role: "real_estate_agency",
      dashboard: "/dashboard/immobilier",
    },
    client: {
      email: CLIENT_EMAIL,
      password: clientPassword,
      account: "/compte",
    },
    listings: createdListings.map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      status: listing.status,
      publicApiUrl: `/api/v1/immobilier/${listing.id}`,
      intendedPublicRoute: `/immobilier/annonce/${listing.id}`,
      staticFrontendRoute: `/immobilier/annonce/?id=${listing.id}`,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
