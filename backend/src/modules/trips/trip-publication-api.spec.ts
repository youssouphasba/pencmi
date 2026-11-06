import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import request = require("supertest");
import { randomUUID } from "crypto";
import { AuthService } from "../../auth/auth.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";
import { TripPublicationService } from "./trip-publication.service";
import { TripOccurrencesService } from "./trip-occurrences.service";

describe("Trip publication HTTP contracts and permissions", () => {
  let app: INestApplication;
  const publication = {
    create: jest.fn(async () => ({ id: "draft", status: "draft" })),
    update: jest.fn(),
    submit: jest.fn(),
    findOwned: jest.fn(),
    softDelete: jest.fn(),
    moderate: jest.fn(async () => ({ status: "active" })),
    findForModeration: jest.fn(async () => ({ data: [] })),
  };
  const service = {
    findPublic: jest.fn(async () => ({ data: [], meta: { total: 0 } })),
    createSeatRequest: jest.fn(),
    findMine: jest.fn(),
    findMySeatRequests: jest.fn(),
    updateSeatRequestStatus: jest.fn(async () => ({ status: "accepted" })),
    contacts: jest.fn(async () => ({ data: [] })),
    conversations: jest.fn(async () => ({ data: [] })),
    statistics: jest.fn(async () => ({ totalRequests: 0 })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TripsController],
      providers: [
        { provide: TripsService, useValue: service },
        { provide: TripPublicationService, useValue: publication },
        { provide: TripOccurrencesService, useValue: { cancel: jest.fn() } },
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              const role = {
                provider: "transport_provider",
                individual: "advertiser_individual",
                admin: "admin",
                hotel: "hotel_manager",
                client: "client",
              }[token];
              if (!role) throw new UnauthorizedException();
              return { id: "authenticated-owner", role, sessionId: "session" };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(
      new JwtAuthGuard(new Reflector(), module.get(AuthService)),
      new PermissionsGuard(new Reflector()),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  it("refuses anonymous access to owner routes", async () => {
    for (const path of [
      "/dashboard/voyages",
      "/dashboard/voyages/id",
      "/dashboard/voyages/contacts",
      "/dashboard/voyages/conversations",
      "/dashboard/voyages/statistics",
    ])
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .post("/dashboard/voyages/id/submit")
      .expect(401);
  });
  it("protects contacts, conversations, statistics and occurrence cancellation with owner permissions", async () => {
    for (const path of ["contacts", "conversations", "statistics"] as const) {
      await request(app.getHttpServer())
        .get(`/dashboard/voyages/${path}`)
        .set("Authorization", "Bearer client")
        .expect(403);
      await request(app.getHttpServer())
        .get(`/dashboard/voyages/${path}`)
        .set("Authorization", "Bearer provider")
        .expect(200);
      expect(service[path]).toHaveBeenCalledWith(
        "authenticated-owner",
        ...(path === "statistics" ? [] : [expect.anything()]),
      );
    }
    await request(app.getHttpServer())
      .post("/dashboard/voyages/id/occurrences/occ/cancel")
      .set("Authorization", "Bearer client")
      .send({ reason: "Annulation" })
      .expect(403);
  });
  it("requires an exact occurrence and refuses privileged request fields", async () => {
    const dto = {
      requestId: randomUUID(),
      clientName: "Client",
      clientEmail: "client@example.test",
      requestedSeats: 1,
    };
    await request(app.getHttpServer())
      .post("/voyages/id/seat-requests")
      .send(dto)
      .expect(400);
    await request(app.getHttpServer())
      .post("/voyages/id/seat-requests")
      .send({
        ...dto,
        occurrenceId: "occ",
        allocatedSeats: 1,
        status: "accepted",
      })
      .expect(400);
    expect(service.createSeatRequest).not.toHaveBeenCalled();
  });
  it.each(["client", "hotel"])(
    "refuses unrelated %s permissions",
    async (role) => {
      await request(app.getHttpServer())
        .post("/dashboard/voyages")
        .set("Authorization", `Bearer ${role}`)
        .send({ requestId: randomUUID() })
        .expect(403);
      expect(publication.create).not.toHaveBeenCalled();
    },
  );
  it.each(["provider", "individual", "admin"])(
    "creates drafts for authorized %s using the authenticated owner only",
    async (role) => {
      const dto = { requestId: randomUUID(), publication: {} };
      await request(app.getHttpServer())
        .post("/dashboard/voyages")
        .set("Authorization", `Bearer ${role}`)
        .send(dto)
        .expect(201);
      expect(publication.create).toHaveBeenCalledWith(
        "authenticated-owner",
        dto,
      );
    },
  );
  it.each(["status", "slug", "ownerUserId"])(
    "rejects arbitrary %s",
    async (key) => {
      await request(app.getHttpServer())
        .post("/dashboard/voyages")
        .set("Authorization", "Bearer provider")
        .send({ requestId: randomUUID(), [key]: "active" })
        .expect(400);
      expect(publication.create).not.toHaveBeenCalled();
    },
  );
  it("rejects missing or malformed requestId and invalid search filters", async () => {
    await request(app.getHttpServer())
      .post("/dashboard/voyages")
      .set("Authorization", "Bearer provider")
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get("/voyages?passengers=-2")
      .expect(400);
    await request(app.getHttpServer())
      .get("/voyages?vehicleType=boat")
      .expect(400);
    await request(app.getHttpServer()).get("/voyages?minPrice=1.5").expect(400);
  });
  it("passes all public filters to the backend", async () => {
    await request(app.getHttpServer())
      .get(
        "/voyages?departureCity=Dakar&date=2099-01-01&passengers=2&vehicleType=bus&minPrice=0&maxPrice=3000&timeOfDay=night&page=2",
      )
      .expect(200);
    expect(service.findPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        departureCity: "Dakar",
        passengers: 2,
        minPrice: 0,
        page: 2,
        timeOfDay: "night",
      }),
    );
  });
  it("routes confirmations through the authenticated owner service", async () => {
    await request(app.getHttpServer())
      .patch("/dashboard/voyages/seat-requests/id/status")
      .set("Authorization", "Bearer provider")
      .send({ status: "accepted" })
      .expect(200);
    expect(service.updateSeatRequestStatus).toHaveBeenCalledWith(
      "authenticated-owner",
      "id",
      { status: "accepted" },
    );
  });
  it.each(["provider", "individual", "client", "hotel"])(
    "refuses moderation to %s",
    async (role) => {
      await request(app.getHttpServer())
        .get("/admin/listings/trips")
        .set("Authorization", `Bearer ${role}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch("/admin/listings/trips/id/status")
        .set("Authorization", `Bearer ${role}`)
        .send({ status: "active" })
        .expect(403);
      expect(publication.moderate).not.toHaveBeenCalled();
    },
  );
  it("allows only authenticated administrative moderation", async () => {
    await request(app.getHttpServer())
      .patch("/admin/listings/trips/id/status")
      .set("Authorization", "Bearer admin")
      .send({ status: "active" })
      .expect(200);
    expect(publication.moderate).toHaveBeenCalledWith(
      "authenticated-owner",
      "id",
      { status: "active" },
    );
  });
});
