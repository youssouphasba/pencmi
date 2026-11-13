import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "crypto";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { resolve, sep } from "path";
import request = require("supertest");
import type SharpFactory from "sharp";
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";
import { ApiResponseInterceptor } from "../../common/interceptors/api-response.interceptor";
import { startAccountFrontend } from "../../common/testing/account-frontend.fixture";
import {
  createTestPassword,
  createTestSecret,
} from "../../common/testing/test-credentials.fixture";
import { ModerationModule } from "../../common/utils/listing-moderation";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AdminListingsService } from "./admin-listings.service";

const target = process.env.TEST_DATABASE_URL;
const sharp: typeof SharpFactory = require("sharp");
type Universe = readonly [ModerationModule, string, string, UserRole];
const universes: readonly Universe[] = [
  ["real_estate", "real-estate", "immobilier", "real_estate_agency"],
  ["hotels", "hotels", "hotels", "hotel_manager"],
  ["vehicles", "vehicles", "voitures", "vehicle_dealer"],
  ["trips", "trips", "voyages", "transport_provider"],
];
type Actor = {
  id: string;
  accessToken: string;
  refreshToken: string;
  identifier: string;
  password: string;
};
type BrowserCredentials = Pick<Actor, "accessToken" | "refreshToken">;
type Notice = {
  type: string;
  message: string;
  metadata?: { listingId?: string };
};
const dateAhead = (days: number) => new Date(Date.now() + days * 86400000);

(target ? describe : describe.skip)(
  "Four-universe administrative moderation over HTTP and PostgreSQL",
  () => {
    let db: PrismaClient, app: INestApplication, directory: string;
    let admin: Actor, secondAdmin: Actor, client: Actor;
    const owners = new Map<ModerationModule, Actor>();
    const userIds: string[] = [];
    const ids: Record<ModerationModule, string[]> = {
      real_estate: [],
      hotels: [],
      vehicles: [],
      trips: [],
    };
    const run = randomUUID();
    const privateValue = randomUUID();
    const http = () => request(app.getHttpServer());
    const auth = (actor: Actor) => ({
      Authorization: `Bearer ${actor.accessToken}`,
    });
    const decisionUrl = (universe: Universe, id: string) =>
      `/api/v1/admin/listings/${universe[1]}/${id}/status`;
    const decide = (
      universe: Universe,
      id: string,
      status: string,
      reason?: string,
      actor = admin,
    ) =>
      http()
        .patch(decisionUrl(universe, id))
        .set(auth(actor))
        .send({ status, ...(reason ? { reason } : {}) });
    const detailUrl = (universe: Universe, id: string) =>
      `/api/v1/admin/validation/${universe[0]}/${id}`;

    beforeAll(async () => {
      const url = new URL(target!);
      if (
        !["localhost", "127.0.0.1"].includes(url.hostname) ||
        !url.pathname.endsWith("_test")
      )
        throw Error("Local isolated PostgreSQL required.");
      db = new PrismaClient({ datasources: { db: { url: target } } });
      directory = await mkdtemp(resolve(tmpdir(), "pencmi-moderation-"));
      const config = {
        DATABASE_URL: target!,
        NODE_ENV: "test",
        STORAGE_DRIVER: "local",
        LOCAL_UPLOAD_DIRECTORY: directory,
        JWT_SECRET: createTestSecret(),
        REFRESH_TOKEN_SECRET: createTestSecret(),
        COOKIE_SECRET: createTestSecret(),
        SAVED_ALERTS_PROCESSOR_ENABLED: "false",
      };
      const previous = Object.fromEntries(
        Object.keys(config).map((key) => [key, process.env[key]]),
      );
      Object.assign(process.env, config);
      try {
        const { AppModule } = await import("../../app.module");
        const module = await Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(db)
          .overrideProvider(ConfigService)
          .useValue(new ConfigService(config))
          .compile();
        app = module.createNestApplication({ logger: false });
        app.setGlobalPrefix("api/v1");
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
          }),
        );
        app.useGlobalFilters(new AllExceptionsFilter());
        app.useGlobalInterceptors(new ApiResponseInterceptor());
        await app.listen(0, "127.0.0.1");
        admin = await actor("admin");
        secondAdmin = await actor("admin");
        client = await actor("client");
        for (const [universe, , , role] of universes)
          owners.set(universe, await actor(role));
      } finally {
        for (const [key, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }, 30000);

    async function actor(role: UserRole): Promise<Actor> {
      const id = randomUUID(),
        password = createTestPassword(),
        identifier = `${id}@example.test`;
      await db.user.create({
        data: {
          id,
          role,
          email: identifier,
          firstName: run,
          lastName: id,
          passwordHash: await bcrypt.hash(password, 4),
        },
      });
      userIds.push(id);
      const response = await http()
        .post("/api/v1/auth/login")
        .send({ identifier, password })
        .expect(201);
      return { id, identifier, password, ...response.body.data };
    }

    afterAll(async () => {
      await app?.close();
      if (db && userIds.length) {
        await db.auditLog.deleteMany({
          where: {
            OR: [
              { actorUserId: { in: userIds } },
              { targetId: { in: Object.values(ids).flat() } },
            ],
          },
        });
        await db.contactEvent.deleteMany({
          where: { ownerUserId: { in: userIds } },
        });
        await db.fileAsset.deleteMany({
          where: { ownerUserId: { in: userIds } },
        });
        await db.hotelReservationRequest.deleteMany({
          where: { propertyId: { in: ids.hotels } },
        });
        await db.tripSeatRequest.deleteMany({
          where: { tripId: { in: ids.trips } },
        });
        await db.tripOccurrence.deleteMany({
          where: { tripId: { in: ids.trips } },
        });
        await db.tripListing.deleteMany({ where: { id: { in: ids.trips } } });
        await db.hotelProperty.deleteMany({
          where: { id: { in: ids.hotels } },
        });
        await db.realEstateVisitRequest.deleteMany({
          where: { listingId: { in: ids.real_estate } },
        });
        await db.realEstateListing.deleteMany({
          where: { id: { in: ids.real_estate } },
        });
        await db.vehicleRentalRequest.deleteMany({
          where: { listingId: { in: ids.vehicles } },
        });
        await db.vehicleListing.deleteMany({
          where: { id: { in: ids.vehicles } },
        });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await db?.$disconnect();
      if (directory && resolve(directory).startsWith(resolve(tmpdir()) + sep))
        await rm(directory, { recursive: true, force: true });
    }, 30000);

    function publication(module: ModerationModule, title: string) {
      const city = `Ville ${run.slice(0, 8)}`,
        destination = `Arrivée ${randomUUID().slice(0, 8)}`;
      const price = randomInt(3000, 50000),
        description = `Description ${randomUUID()}`;
      const metadata = {
        contactPreferences: {
          internalMessagingEnabled: true,
          contactFormEnabled: true,
          notificationEmail: `${privateValue}@example.test`,
        },
      };
      if (module === "real_estate")
        return {
          title,
          description,
          transaction: "location",
          propertyType: "appartement",
          metadata: {
            ...metadata,
            location: { city, region: city },
            pricing: { price, currency: "FCFA" },
          },
        };
      if (module === "vehicles")
        return {
          title,
          description,
          vehicleMode: "rental",
          metadata: {
            ...metadata,
            identity: {
              brand: `Marque ${run.slice(0, 6)}`,
              model: `Modèle ${randomUUID().slice(0, 6)}`,
              year: new Date().getFullYear(),
            },
            info: {
              fuel: "Essence",
              gearbox: "Automatique",
              category: "Berline",
              seats: randomInt(4, 6),
              condition: "Occasion",
            },
            location: { city, region: city, addressHint: privateValue },
            pricing: { pricePerDay: price, currency: "FCFA" },
          },
        };
      if (module === "hotels")
        return {
          name: title,
          propertyType: "hotel",
          city,
          description,
          address: privateValue,
          metadata: {
            contactPreferences: {
              ...metadata.contactPreferences,
              reservationRequestEnabled: true,
            },
          },
          rooms: [
            {
              clientId: randomUUID(),
              name: `Chambre ${randomUUID().slice(0, 8)}`,
              capacity: 2,
              adults: 2,
              beds: 1,
              totalUnits: 2,
              basePrice: price,
              currency: "FCFA",
              enabled: true,
              rates: [
                {
                  start: dateAhead(4).toISOString().slice(0, 10),
                  end: dateAhead(4).toISOString().slice(0, 10),
                  price,
                  currency: "FCFA",
                },
              ],
              calendar: [
                {
                  start: dateAhead(4).toISOString().slice(0, 10),
                  end: dateAhead(4).toISOString().slice(0, 10),
                  available: 2,
                  status: "open",
                  stopSell: false,
                },
              ],
            },
          ],
        };
      return {
        publication: {
          vehicleType: "bus",
          route: { departureCity: city, arrivalCity: destination },
          schedule: {
            date: dateAhead(7).toISOString().slice(0, 10),
            departureTime: "14:30",
            regular: false,
          },
          vehicle: { totalSeats: 5 },
          pricing: { availableSeats: 4, pricePerSeat: price, currency: "FCFA" },
          content: { title, description },
          contactPreferences: { reservationRequestEnabled: true },
        },
      };
    }

    async function create(
      universe: Universe,
      title = `Annonce ${randomUUID()}`,
      submit = true,
    ) {
      const [module, , path] = universe;
      const owner = owners.get(module)!;
      const base = `/api/v1/dashboard/${path}`;
      const response = await http()
        .post(base)
        .set(auth(owner))
        .send({ requestId: randomUUID() })
        .expect(201);
      const id: string = response.body.data.id;
      ids[module].push(id);
      expect(response.body.data.status).toBe("draft");
      const input = publication(module, title);
      await http()
        .patch(`${base}/${id}`)
        .set(auth(owner))
        .send(input)
        .expect(200);
      if (submit)
        await http().post(`${base}/${id}/submit`).set(auth(owner)).expect(201);
      return { id, owner, base, input, title };
    }

    it.each(universes)(
      "%s: real approval, public visibility, favorites, suspension, reactivation, refusal and resubmission",
      async (...universe) => {
        const [module, route, path] = universe;
        const item = await create(universe, undefined, false);
        const { id, owner, base, input } = item;
        const publicUrl = `/api/v1/${path}/${id}`;
        await decide(universe, id, "active").expect(409);
        await http().get(publicUrl).expect(404);
        await http().post(`${base}/${id}/submit`).set(auth(owner)).expect(201);
        await http().get(publicUrl).expect(404);
        await http()
          .get(`/api/v1/admin/listings/${route}`)
          .set(auth(admin))
          .expect(200);
        const queue = await http()
          .get("/api/v1/admin/validation")
          .query({
            module,
            status: "pending_review",
            ownerId: owner.id,
            search: item.title,
          })
          .set(auth(admin))
          .expect(200);
        expect(queue.body.meta.total).toBe(1);
        expect(queue.body.data[0]).toMatchObject({
          id,
          module,
          status: "pending_review",
        });
        const details = await http()
          .get(detailUrl(universe, id))
          .set(auth(admin))
          .expect(200);
        expect(JSON.stringify(details.body)).not.toContain(privateValue);
        expect(JSON.stringify(details.body)).not.toContain(owner.identifier);
        const concurrent = await Promise.all([
          decide(universe, id, "active"),
          decide(universe, id, "active", undefined, secondAdmin),
        ]);
        expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
        await http().get(publicUrl).expect(200);
        await http()
          .put(`/api/v1/favorites/${module}/${id}`)
          .set(auth(client))
          .expect(200);
        const reason = `Motif ${randomUUID()}`;
        await decide(universe, id, "suspended").expect(400);
        await decide(universe, id, "suspended", reason).expect(200);
        await http().get(publicUrl).expect(404);
        const favorites = await http()
          .get("/api/v1/favorites")
          .query({ module })
          .set(auth(client))
          .expect(200);
        expect(
          favorites.body.data.find(
            (row: { listingId: string }) => row.listingId === id,
          ),
        ).toMatchObject({ available: false, url: null });
        await decide(universe, id, "active").expect(200);
        await http().get(publicUrl).expect(200);
        await decide(universe, id, "suspended", reason).expect(200);
        await decide(universe, id, "refused", reason).expect(200);
        await decide(universe, id, "active").expect(409);
        const logs = await db.auditLog.findMany({
          where: {
            module,
            targetId: id,
            action: {
              in: [
                "listing.active",
                "listing.refused",
                "listing.suspended",
                "trip.active",
                "trip.refused",
                "trip.suspended",
              ],
            },
          },
        });
        expect(logs).toHaveLength(5);
        expect(
          logs.find((log) => log.action.endsWith(".refused")),
        ).toMatchObject({
          actorUserId: admin.id,
          metadata: {
            previousStatus: "suspended",
            newStatus: "refused",
            reason,
          },
        });
        const notifications = await http()
          .get("/api/v1/notifications")
          .set(auth(owner))
          .expect(200);
        expect(
          notifications.body.data.filter(
            (n: Notice) => n.metadata?.listingId === id,
          ),
        ).toHaveLength(5);
        expect(
          notifications.body.data.find(
            (n: Notice) =>
              n.metadata?.listingId === id && n.type === "listing_refused",
          ).message,
        ).toContain(reason);
        await http()
          .patch(`${base}/${id}`)
          .set(auth(owner))
          .send(input)
          .expect(200);
        await http().post(`${base}/${id}/submit`).set(auth(owner)).expect(201);
        await decide(universe, id, "refused", reason).expect(200);
        await http().get(publicUrl).expect(404);
      },
    );

    it("enforces strict guards and DTOs, excludes deleted entries, rejects stale revisions and revalidates stored content", async () => {
      const universe = universes[0];
      const { id, owner } = await create(universe);
      await http().get("/api/v1/admin/validation").expect(401);
      await http()
        .patch(decisionUrl(universe, id))
        .send({ status: "active" })
        .expect(401);
      for (const actor of [client, owner]) {
        await http().get(detailUrl(universe, id)).set(auth(actor)).expect(403);
        await http()
          .get("/api/v1/admin/validation")
          .set(auth(actor))
          .expect(403);
        await decide(universe, id, "active", undefined, actor).expect(403);
      }
      for (const query of [
        { module: "system" },
        { status: "deleted" },
        { ownerId: ["a", "b"] },
        { limit: 101 },
        { ownerUserId: owner.id },
      ])
        await http()
          .get("/api/v1/admin/validation")
          .query(query)
          .set(auth(admin))
          .expect(400);
      for (const body of [
        { status: "draft" },
        { status: "active", actorUserId: secondAdmin.id },
        { status: "active", ownerUserId: client.id },
        { status: "refused", reason: " ".repeat(5) },
        { status: "suspended", reason: randomUUID().repeat(100) },
      ])
        await http()
          .patch(decisionUrl(universe, id))
          .set(auth(admin))
          .send(body)
          .expect(400);
      await http()
        .patch(decisionUrl(universe, id))
        .set(auth(admin))
        .send({
          status: "active",
          expectedUpdatedAt: dateAhead(-1).toISOString(),
        })
        .expect(409);
      await db.realEstateListing.update({
        where: { id },
        data: { metadata: { publication: [] } },
      });
      await decide(universe, id, "active").expect(400);
      expect(
        await db.auditLog.count({
          where: { targetId: id, action: "listing.active" },
        }),
      ).toBe(0);
      expect(
        await db.notification.count({
          where: {
            userId: owner.id,
            metadata: { path: ["listingId"], equals: id },
          },
        }),
      ).toBe(0);
      await db.realEstateListing.update({
        where: { id },
        data: { status: "deleted", deletedAt: new Date() },
      });
      await decide(universe, id, "active").expect(404);
      await http().get(detailUrl(universe, id)).set(auth(admin)).expect(404);
      await decide(universe, randomUUID(), "active").expect(404);
    });

    it("keeps allocations, calendar, rates, sync settings and requests unchanged across hotel decisions", async () => {
      const universe = universes[1];
      const { id, owner } = await create(universe);
      await decide(universe, id, "active").expect(200);
      const room = await db.hotelRoom.findFirstOrThrow({
        where: { propertyId: id },
        include: { rates: true, availability: true, restrictions: true },
      });
      const requested = await http()
        .post(`/api/v1/hotels/${id}/reservation-requests`)
        .set(auth(client))
        .send({
          requestId: randomUUID(),
          roomId: room.id,
          units: 1,
          guests: 1,
          checkIn: room.availability[0].date.toISOString().slice(0, 10),
          checkOut: dateAhead(5).toISOString().slice(0, 10),
          clientName: `Client ${run}`,
          clientEmail: client.identifier,
        })
        .expect(201);
      const requestId = requested.body.data.id;
      await http()
        .patch(`/api/v1/dashboard/hotels/reservations/${requestId}/status`)
        .set(auth(owner))
        .send({ status: "accepted" })
        .expect(200);
      const reservation = await db.hotelReservationRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      const allocation = await db.hotelStockAllocation.findFirstOrThrow({
        where: { requestId },
      });
      const integration = await db.hotelIntegration.create({
        data: { propertyId: id, status: "active", syncMode: "ical" },
      });
      await decide(universe, id, "suspended", randomUUID()).expect(200);
      await decide(universe, id, "active").expect(200);
      expect(
        await db.hotelRoom.findUnique({
          where: { id: room.id },
          include: { rates: true, availability: true, restrictions: true },
        }),
      ).toEqual(room);
      expect(
        await db.hotelReservationRequest.findUnique({
          where: { id: reservation.id },
        }),
      ).toEqual(reservation);
      expect(
        await db.hotelStockAllocation.findUnique({
          where: { id: allocation.id },
        }),
      ).toEqual(allocation);
      expect(
        await db.hotelIntegration.findUnique({ where: { id: integration.id } }),
      ).toEqual(integration);
    });

    it("paginates the cross-universe queue on the server and scopes unpublished photo previews", async () => {
      const [first, second] = await Promise.all([
        create(universes[0]),
        create(universes[2]),
      ]);
      const query = { advertiser: run, status: "pending_review", limit: 1 };
      const one = await http()
        .get("/api/v1/admin/validation")
        .query(query)
        .set(auth(admin))
        .expect(200);
      const two = await http()
        .get("/api/v1/admin/validation")
        .query({ ...query, page: 2 })
        .set(auth(admin))
        .expect(200);
      expect(one.body.meta.total).toBeGreaterThan(1);
      expect(one.body.data[0].id).not.toBe(two.body.data[0].id);
      const image = await sharp({
        create: { width: 16, height: 16, channels: 3, background: "#376a59" },
      })
        .png()
        .toBuffer();
      const upload = await http()
        .post(`${first.base}/${first.id}/photos`)
        .set(auth(first.owner))
        .field("uploadId", randomUUID())
        .attach("photo", image, "image.png")
        .expect(201);
      const photoId = upload.body.data.id;
      const preview = `${detailUrl(universes[0], first.id)}/photos/${photoId}`;
      await http().get(preview).expect(401);
      await http().get(preview).set(auth(client)).expect(403);
      await http().get(`/api/v1/files/public/${photoId}`).expect(404);
      await http()
        .get(`${detailUrl(universes[2], second.id)}/photos/${photoId}`)
        .set(auth(admin))
        .expect(404);
      await http()
        .get(preview)
        .set(auth(admin))
        .expect(200)
        .expect("Cache-Control", "private, no-store");
    });

    it("rolls back the status when the audit insert fails inside PostgreSQL", async () => {
      const { id, owner } = await create(universes[2]);
      await expect(
        app
          .get(AdminListingsService)
          .moderate("vehicles", randomUUID(), id, { status: "active" }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(
        (await db.vehicleListing.findUniqueOrThrow({ where: { id } })).status,
      ).toBe("pending_review");
      expect(await db.auditLog.count({ where: { targetId: id } })).toBe(0);
      expect(
        await db.notification.count({
          where: {
            userId: owner.id,
            metadata: { path: ["listingId"], equals: id },
          },
        }),
      ).toBe(0);
    });

    (process.env.PENCMI_PLAYWRIGHT_MODULE ? it : it.skip)(
      "moderates from the real browser across four widths and refreshes counts only after success",
      async () => {
        const { chromium } = require(
          process.env.PENCMI_PLAYWRIGHT_MODULE!.replace(
            /index\.mjs$/,
            "index.js",
          ),
        );
        const browser = await chromium.launch({
          channel: "msedge",
          headless: true,
        });
        const address = app.getHttpServer().address() as { port: number };
        const frontend = await startAccountFrontend(
          `http://127.0.0.1:${address.port}`,
        );
        try {
          for (const [index, width] of [360, 390, 768, 1280].entries()) {
            const universe = universes[index];
            const title = `Annonce ${randomUUID()} <img src=x>`;
            const item = await create(universe, title);
            if (index === 0) {
              const image = await sharp({
                create: {
                  width: 32,
                  height: 24,
                  channels: 3,
                  background: "#376a59",
                },
              })
                .png()
                .toBuffer();
              await http()
                .post(`${item.base}/${item.id}/photos`)
                .set(auth(item.owner))
                .field("uploadId", randomUUID())
                .attach("photo", image, "image.png")
                .expect(201);
              await http()
                .post(`${item.base}/${item.id}/submit`)
                .set(auth(item.owner))
                .expect(201);
            }
            const context = await browser.newContext({
              viewport: { width, height: 900 },
            });
            try {
              await context.addInitScript(
                ({ accessToken, refreshToken }: BrowserCredentials) => {
                  localStorage.setItem("pencmi_access_token", accessToken);
                  localStorage.setItem("pencmi_refresh_token", refreshToken);
                },
                {
                  accessToken: admin.accessToken,
                  refreshToken: admin.refreshToken,
                },
              );
              const page = await context.newPage();
              const paths = new Set<string>();
              page.on("request", (entry: { url(): string }) =>
                paths.add(new URL(entry.url()).pathname),
              );
              await page.goto(
                `${frontend.origin}/admin/validation/?module=${universe[0]}&search=${encodeURIComponent(title)}`,
              );
              const exam = page.getByRole("button", {
                name: `Examiner ${title}`,
                exact: true,
              });
              await exam.waitFor();
              const badge = page.locator(
                '#admin-sidebar a[href="/admin/validation"] .notification-badge',
              );
              const pendingBefore = Number(
                (await badge.textContent()).replace(/\s/g, ""),
              );
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth,
                ),
              ).toBe(true);
              await exam.focus();
              await page.keyboard.press("Enter");
              const dialog = page.getByRole("dialog");
              await dialog
                .getByRole("heading", { name: title, exact: true })
                .waitFor();
              expect(await dialog.locator("img").count()).toBe(0);
              expect(
                await dialog.evaluate(
                  (element: HTMLElement) =>
                    element.scrollWidth <= element.clientWidth,
                ),
              ).toBe(true);
              expect(
                await dialog.evaluate((element: HTMLElement) =>
                  Array.from(element.querySelectorAll("*")).some((node) =>
                    Array.from(node.childNodes).some(
                      (child) =>
                        child.nodeType === 3 && child.textContent === "null",
                    ),
                  ),
                ),
              ).toBe(false);
              if (index === 0) {
                await dialog.getByText("Photos (1)", { exact: true }).click();
                const image = dialog.getByRole("img", {
                  name: "Photo 1 sur 1",
                });
                await image.waitFor();
                await image.evaluate((element: HTMLImageElement) =>
                  element.decode(),
                );
              }
              const artifacts = process.env.PENCMI_MODERATION_ARTIFACTS;
              if (artifacts && (width === 360 || width === 1280)) {
                await mkdir(artifacts, { recursive: true });
                await page.screenshot({
                  path: resolve(artifacts, `moderation-${width}.png`),
                });
              }
              await page.keyboard.press("Escape");
              await dialog.waitFor({ state: "hidden" });
              await exam.click();
              await dialog
                .getByRole("button", { name: "Valider", exact: true })
                .click();
              if (index === 0) {
                const endpoint = `**${decisionUrl(universe, item.id)}`;
                await page.route(
                  endpoint,
                  (route: { abort(reason: string): Promise<void> }) =>
                    route.abort("failed"),
                );
                await dialog
                  .getByRole("button", {
                    name: "Confirmer : valider",
                    exact: true,
                  })
                  .click();
                await dialog
                  .getByRole("alert")
                  .filter({ hasText: /connexion|réseau|inaccessible/i })
                  .waitFor();
                expect(
                  await page
                    .getByText("Décision enregistrée.", { exact: true })
                    .count(),
                ).toBe(0);
                await http()
                  .get(`/api/v1/${universe[2]}/${item.id}`)
                  .expect(404);
                await page.unroute(endpoint);
              }
              await dialog
                .getByRole("button", {
                  name: "Confirmer : valider",
                  exact: true,
                })
                .click();
              await page
                .getByText("Décision enregistrée.", { exact: true })
                .waitFor();
              await page
                .getByText("Aucune annonce ne correspond aux filtres.", {
                  exact: true,
                })
                .waitFor();
              await http().get(`/api/v1/${universe[2]}/${item.id}`).expect(200);
              await page.waitForFunction(
                (count: number) =>
                  Number(
                    document
                      .querySelector(
                        '#admin-sidebar a[href="/admin/validation"] .notification-badge',
                      )
                      ?.textContent?.replace(/\s/g, ""),
                  ) === count,
                pendingBefore - 1,
              );
              for (const path of [
                "/api/v1/admin/users",
                "/api/v1/admin/advertisers",
                "/api/v1/hotels",
                "/api/v1/voitures",
              ])
                expect(paths.has(path)).toBe(false);
            } finally {
              await context.close();
            }
          }
          const owner = owners.get("real_estate")!;
          const context = await browser.newContext();
          try {
            await context.addInitScript(
              ({ accessToken, refreshToken }: BrowserCredentials) => {
                localStorage.setItem("pencmi_access_token", accessToken);
                localStorage.setItem("pencmi_refresh_token", refreshToken);
              },
              {
                accessToken: owner.accessToken,
                refreshToken: owner.refreshToken,
              },
            );
            const page = await context.newPage();
            await page.goto(`${frontend.origin}/dashboard/notifications/`);
            await page
              .getByRole("heading", { name: "Annonce validée", exact: true })
              .first()
              .waitFor();
          } finally {
            await context.close();
          }
        } finally {
          await browser.close();
          await frontend.close();
        }
      },
      90000,
    );
  },
);
