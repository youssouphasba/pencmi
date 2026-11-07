import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ListingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma/prisma.service";
import { getPagination } from "../../common/pagination/pagination.dto";
import {
  assertModerationTransition,
  assertModerationVersion,
  MODERATION_MODULES,
  ModerationModule,
  recordListingDecision,
} from "../../common/utils/listing-moderation";
import { FilesService } from "../../files/files.service";
import {
  hotelRoomsInclude,
  hotelSettings,
  validateStoredHotelPublication,
} from "../hotels/hotel-publication.service";
import { validateStoredRealEstatePublication } from "../real-estate/real-estate.service";
import { validateStoredVehiclePublication } from "../vehicles/vehicle-publication.service";
import { vehiclePrimaryPrice } from "../vehicles/vehicle-publication.schema";
import {
  AdminListingDecisionDto,
  AdminListingsQuery,
} from "./admin-listings.dto";

type NonTripModule = Exclude<ModerationModule, "trips">;
type ListingRow = {
  id: string;
  module: ModerationModule;
  title: string;
  city: string;
  kind: string | null;
  status: ListingStatus;
  ownerId: string;
  advertiser: string;
  updatedAt: Date;
  createdAt: Date;
  price: number | null;
  currency: string | null;
  description?: string | null;
  departureDate: Date | null;
  departureTime: string | null;
  seats: number | null;
};

const sources = {
  real_estate: {
    table: Prisma.sql`"RealEstateListing"`,
    title: Prisma.sql`l.title`,
    city: Prisma.sql`l.city`,
    kind: Prisma.sql`l."propertyType"`,
    price: Prisma.sql`l.price`,
    currency: Prisma.sql`l.currency`,
    description: Prisma.sql`l.description`,
  },
  hotels: {
    table: Prisma.sql`"HotelProperty"`,
    title: Prisma.sql`l.name`,
    city: Prisma.sql`l.city`,
    kind: Prisma.sql`l."propertyType"`,
    price: Prisma.sql`NULL::integer`,
    currency: Prisma.sql`NULL::text`,
    description: Prisma.sql`l.description`,
  },
  vehicles: {
    table: Prisma.sql`"VehicleListing"`,
    title: Prisma.sql`l.title`,
    city: Prisma.sql`l.city`,
    kind: Prisma.sql`l."vehicleMode"`,
    price: Prisma.sql`l.price`,
    currency: Prisma.sql`l.currency`,
    description: Prisma.sql`l.description`,
  },
  trips: {
    table: Prisma.sql`"TripListing"`,
    title: Prisma.sql`l.title`,
    city: Prisma.sql`concat(l."departureCity", ' → ', l."arrivalCity")`,
    kind: Prisma.sql`l."vehicleType"`,
    price: Prisma.sql`l."pricePerSeat"`,
    currency: Prisma.sql`l.currency`,
    description: Prisma.sql`COALESCE(l.metadata #>> '{publication,content,description}', l.metadata ->> 'description')`,
  },
} satisfies Record<ModerationModule, Record<string, Prisma.Sql>>;

function listingSource(module: ModerationModule, detailId?: string) {
  const source = sources[module];
  const schedule =
    module === "trips"
      ? Prisma.sql`l."departureDate", l."departureTime", l."availableSeats" AS seats`
      : Prisma.sql`NULL::timestamp AS "departureDate", NULL::text AS "departureTime", NULL::integer AS seats`;
  return Prisma.sql`SELECT ${module}::text AS module, l.id, l.status,
    l."ownerUserId" AS "ownerId", l."updatedAt", l."createdAt",
    ${source.title} AS title, ${source.city} AS city, ${source.kind} AS kind,
    ${source.price} AS price, ${source.currency} AS currency, ${schedule},
    COALESCE(NULLIF(p."businessName", ''), concat_ws(' ', u."firstName", u."lastName")) AS advertiser
    ${detailId ? Prisma.sql`, ${source.description} AS description` : Prisma.empty}
    FROM ${source.table} l JOIN "User" u ON u.id = l."ownerUserId"
    LEFT JOIN "ProfessionalProfile" p ON p."userId" = u.id
    WHERE l."deletedAt" IS NULL AND l.status <> 'deleted'
    ${detailId ? Prisma.sql`AND l.id = ${detailId}` : Prisma.empty}`;
}

const imageTypes = ["image/jpeg", "image/png", "image/webp"];

@Injectable()
export class AdminListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(query: AdminListingsQuery, scope?: NonTripModule) {
    if (scope && query.module && query.module !== scope)
      throw new BadRequestException("Univers incompatible avec cette route.");
    const module = scope || query.module;
    const source = Prisma.join(
      (module ? [module] : MODERATION_MODULES).map((key) => listingSource(key)),
      " UNION ALL ",
    );
    const filtered = Prisma.sql`FROM (${source}) l WHERE true
      ${query.status ? Prisma.sql`AND l.status = ${query.status}::"ListingStatus"` : Prisma.empty}
      ${query.ownerId ? Prisma.sql`AND l."ownerId" = ${query.ownerId}` : Prisma.empty}
      ${query.advertiser ? Prisma.sql`AND strpos(lower(l.advertiser), lower(${query.advertiser})) > 0` : Prisma.empty}
      ${query.search ? Prisma.sql`AND strpos(lower(concat_ws(' ', l.title, l.city, l.id)), lower(${query.search})) > 0` : Prisma.empty}`;
    const page = getPagination(query);
    const [data, totals] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<
          ListingRow[]
        >`SELECT * ${filtered} ORDER BY "updatedAt" DESC, module ASC, id ASC LIMIT ${page.take} OFFSET ${page.skip}`,
        this.prisma.$queryRaw<
          { total: bigint }[]
        >`SELECT count(*) AS total ${filtered}`,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data, meta: page.meta(Number(totals[0].total)) };
  }

  private async listing(module: ModerationModule, id: string) {
    const [row] = await this.prisma.$queryRaw<
      ListingRow[]
    >`${listingSource(module, id)}`;
    if (!row) throw new NotFoundException("Annonce introuvable.");
    return row;
  }

  private photosWhere(row: ListingRow): Prisma.FileAssetWhereInput {
    return {
      ownerUserId: row.ownerId,
      module: row.module,
      visibility: "public",
      deletedAt: null,
      mimeType: { in: imageTypes },
      usages: { some: { targetType: "listing", targetId: row.id } },
    };
  }

  async detail(module: ModerationModule, id: string) {
    const row = await this.listing(module, id);
    const [photos, rooms] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where: this.photosWhere(row),
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      module === "hotels"
        ? this.prisma.hotelRoom.findMany({
            where: { propertyId: id, status: { not: "deleted" } },
            select: {
              name: true,
              capacity: true,
              status: true,
              metadata: true,
            },
            orderBy: [{ name: "asc" }, { id: "asc" }],
          })
        : [],
    ]);
    return {
      ...row,
      photos,
      rooms: rooms.map(({ metadata, ...room }) => {
        const settings = hotelSettings(metadata);
        return {
          ...room,
          basePrice:
            typeof settings.basePrice === "number" ? settings.basePrice : null,
          totalUnits:
            typeof settings.totalUnits === "number"
              ? settings.totalUnits
              : null,
        };
      }),
    };
  }

  async photo(module: ModerationModule, id: string, photoId: string) {
    const row = await this.listing(module, id);
    const photo = await this.prisma.fileAsset.findFirst({
      where: { ...this.photosWhere(row), id: photoId },
      select: { id: true },
    });
    if (!photo) throw new NotFoundException("Photo introuvable.");
    return this.files.streamOwnedContent(photoId, row.ownerId);
  }

  async moderate(
    module: NonTripModule,
    actor: string,
    id: string,
    dto: AdminListingDecisionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ${sources[module].table} WHERE id = ${id} FOR UPDATE`;
      const where = {
        id,
        deletedAt: null,
        status: { not: ListingStatus.deleted },
      };
      const row =
        module === "real_estate"
          ? await tx.realEstateListing.findFirst({ where })
          : module === "vehicles"
            ? await tx.vehicleListing.findFirst({ where })
            : await tx.hotelProperty.findFirst({ where });
      if (!row) throw new NotFoundException("Annonce introuvable.");
      assertModerationVersion(row.updatedAt, dto.expectedUpdatedAt);
      assertModerationTransition(row.status, dto.status, dto.reason);
      if (dto.status === "active")
        await this.validateActivation(tx, module, id);
      const options = {
        where: { id },
        data: { status: dto.status },
        select: { id: true, status: true, updatedAt: true },
      };
      const updated =
        module === "real_estate"
          ? await tx.realEstateListing.update(options)
          : module === "vehicles"
            ? await tx.vehicleListing.update(options)
            : await tx.hotelProperty.update(options);
      await recordListingDecision(
        tx,
        actor,
        module,
        row,
        dto.status,
        dto.reason,
      );
      return { ...updated, module };
    });
  }

  private async validateActivation(
    tx: Prisma.TransactionClient,
    module: NonTripModule,
    id: string,
  ) {
    if (module === "hotels") {
      await tx.$queryRaw`SELECT id FROM "HotelIntegration" WHERE "propertyId" = ${id} FOR UPDATE`;
      validateStoredHotelPublication(
        await tx.hotelProperty.findUniqueOrThrow({
          where: { id },
          include: { rooms: { include: hotelRoomsInclude } },
        }),
      );
      return;
    }
    if (module === "real_estate") {
      const row = await tx.realEstateListing.findUniqueOrThrow({
        where: { id },
      });
      const parsed = validateStoredRealEstatePublication(row);
      if (
        parsed.metadata?.pricing?.price === row.price &&
        parsed.metadata?.location?.city === row.city &&
        row.currency === "FCFA"
      )
        return;
    } else {
      const row = await tx.vehicleListing.findUniqueOrThrow({ where: { id } });
      const parsed = validateStoredVehiclePublication(row);
      if (
        parsed.metadata?.pricing &&
        vehiclePrimaryPrice(row.vehicleMode, parsed.metadata.pricing) ===
          row.price &&
        parsed.metadata.location?.city === row.city &&
        row.currency === "FCFA"
      )
        return;
    }
    throw new BadRequestException(
      "Les données de publication ne correspondent pas à l’annonce. Demandez une correction avant de valider.",
    );
  }
}
