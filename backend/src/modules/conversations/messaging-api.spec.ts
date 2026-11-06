import { INestApplication, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request = require("supertest");
import { randomUUID } from "crypto";
import { AuthService } from "../../auth/auth.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { ApiResponseInterceptor } from "../../common/interceptors/api-response.interceptor";
import { PrismaService } from "../../database/prisma/prisma.service";
import { ContactsController } from "../contacts/contacts.controller";
import { ContactsService } from "../contacts/contacts.service";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { createFakePrisma } from "./fake-prisma.fixture";

const open = { internalMessagingEnabled: true };
const settings = (contactPreferences: unknown) => ({ publication: { contactPreferences } });
const UNIVERSES = [
  ["real_estate", "realEstateListing"],
  ["hotels", "hotelProperty"],
  ["vehicles", "vehicleListing"],
  ["trips", "tripListing"],
] as const;

describe("Messaging and contacts over HTTP", () => {
  let app: INestApplication;
  let db: any;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function listing(table: string, id: string, overrides: Record<string, unknown> = {}, preferences: unknown = open) {
    const body = table === "hotelProperty"
      ? { name: `Titre ${id}`, contactSettings: settings(preferences) }
      : { title: `Titre ${id}`, metadata: settings(preferences) };
    await db[table].create({ data: { id, ownerUserId: "owner", status: "active", deletedAt: null, ...body, ...overrides } });
  }
  const send = (token: string, module: string, listingId: string, body = "Bonjour", requestId: string = randomUUID()) =>
    http().post("/messages/conversations").set(as(token)).send({ module, listingId, body, requestId });

  beforeAll(async () => {
    db = createFakePrisma();
    const module = await Test.createTestingModule({
      controllers: [ConversationsController, ContactsController],
      providers: [
        ConversationsService,
        ContactsService,
        { provide: PrismaService, useFactory: () => db },
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              if (!["client", "owner", "stranger", "rival"].includes(token)) throw new UnauthorizedException();
              return { id: token, role: token === "client" ? "client" : "real_estate_agency", sessionId: "session" };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new JwtAuthGuard(new Reflector(), module.get(AuthService)), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    const fresh = createFakePrisma();
    Object.keys(db).forEach((key) => delete db[key]);
    Object.assign(db, fresh);
    for (const [id, firstName, lastName] of [["client", "Awa", "Diop"], ["owner", "Ibra", "Fall"], ["stranger", "Sam", "Ba"], ["rival", "Rita", "Sow"]])
      await db.user.create({ data: { id, firstName, lastName, status: "active", email: `${id}@example.test`, phone: `+22177${id.length}` } });
    for (const [, table] of UNIVERSES) await listing(table, `l_${table}`);
  });

  describe.each(UNIVERSES)("universe %s", (module, table) => {
    const id = `l_${table}`;

    it("lets a client write, read it back and the owner answer from the right inbox", async () => {
      const opened = await send("client", module, id, "Toujours disponible ?").expect(201);
      const conversationId = opened.body.data.conversationId;
      expect(opened.body.data.created).toBe(true);
      const again = await http().get(`/messages/conversations/by-listing?module=${module}&listingId=${id}`).set(as("client")).expect(200);
      expect(again.body.data.messages.map((row: any) => row.body)).toEqual(["Toujours disponible ?"]);

      const inbox = await http().get(`/messages/conversations?scope=owner&module=${module}`).set(as("owner")).expect(200);
      expect(inbox.body.meta.total).toBe(1);
      expect(inbox.body.data[0]).toMatchObject({ id: conversationId, unreadCount: 1, listingTitle: `Titre ${id}`, counterpartName: "Awa Diop" });

      await http().post(`/messages/conversations/${conversationId}/messages`).set(as("owner")).send({ body: "Oui", requestId: randomUUID() }).expect(201);
      await http().patch(`/messages/conversations/${conversationId}/read`).set(as("owner")).expect(200);
      const read = await http().get(`/messages/conversations?scope=owner&module=${module}`).set(as("owner")).expect(200);
      expect(read.body.data[0].unreadCount).toBe(0);
      const client = await http().get("/messages/conversations").set(as("client")).expect(200);
      expect(client.body.data[0]).toMatchObject({ unreadCount: 1, counterpartName: "Ibra Fall" });
    });

    it("hides the conversation of an owner from the inbox of the other universes", async () => {
      await send("client", module, id).expect(201);
      for (const [other] of UNIVERSES.filter(([name]) => name !== module)) {
        const inbox = await http().get(`/messages/conversations?scope=owner&module=${other}`).set(as("owner")).expect(200);
        expect(inbox.body.meta.total).toBe(0);
      }
    });

    it.each([
      ["draft", { status: "draft" }],
      ["suspended", { status: "suspended" }],
      ["deleted", { status: "active", deletedAt: new Date() }],
    ])("refuses a %s listing", async (_name, change) => {
      await db[table].update({ where: { id }, data: change });
      await send("client", module, id).expect(404);
      expect(await db.conversation.count()).toBe(0);
    });

    it("refuses a disabled channel and a listing without a choice", async () => {
      let index = 0;
      for (const preferences of [{ internalMessagingEnabled: false }, {}, null])
        await listing(table, `off_${index++}`, {}, preferences);
      for (const row of db[table].rows.filter((item: any) => item.id.startsWith("off_")))
        await send("client", module, row.id).expect(409);
      expect(await db.conversation.count()).toBe(0);
      expect(await db.contactEvent.count()).toBe(0);
    });

    it("refuses a conversation with oneself", async () => {
      await send("owner", module, id).expect(403);
    });
  });

  it("refuses an unknown listing, an unknown universe and anonymous access", async () => {
    await send("client", "vehicles", "absent").expect(404);
    await send("client", "support", "l_vehicleListing").expect(400);
    await http().post("/messages/conversations").send({}).expect(401);
    await http().get("/messages/conversations").expect(401);
    await http().get("/dashboard/contacts").expect(401);
  });

  it("requires a request id and refuses an empty or oversized message", async () => {
    const base = { module: "vehicles", listingId: "l_vehicleListing" };
    await http().post("/messages/conversations").set(as("client")).send({ ...base, body: "Bonjour" }).expect(400);
    await send("client", "vehicles", "l_vehicleListing", "   ").expect(400);
    await send("client", "vehicles", "l_vehicleListing", "x".repeat(6001)).expect(400);
    expect(await db.conversation.count()).toBe(0);
  });

  it("gives one conversation, one message and one contact to a retry and to concurrent clicks", async () => {
    const requestId = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => send("client", "trips", "l_tripListing", "Une place ?", requestId)));
    expect(results.map((row) => row.status)).toEqual([201, 201, 201, 201, 201]);
    expect(new Set(results.map((row) => row.body.data.conversationId)).size).toBe(1);
    expect(new Set(results.map((row) => row.body.data.message.id)).size).toBe(1);
    expect(await db.conversation.count()).toBe(1);
    expect(await db.message.count()).toBe(1);
    expect(await db.contactEvent.count({ where: { source: "internal_message" } })).toBe(1);
    await send("client", "trips", "l_tripListing", "Autre question").expect(201);
    expect(await db.conversation.count()).toBe(1);
    expect(await db.message.count()).toBe(2);
    expect(await db.contactEvent.count({ where: { source: "internal_message" } })).toBe(1);
    await send("client", "trips", "l_tripListing", "Autre contenu", requestId).expect(409);
  });

  it("finds an older conversation between the same two people instead of adding one", async () => {
    await db.conversation.create({ data: { id: "legacy", module: "hotels", targetType: "listing", targetId: "l_hotelProperty",
      participants: { create: [{ userId: "client" }, { userId: "owner" }] } } });
    const opened = await send("client", "hotels", "l_hotelProperty").expect(201);
    expect(opened.body.data).toMatchObject({ conversationId: "legacy", created: false });
    expect(await db.conversation.count()).toBe(1);
  });

  it("rolls everything back when the first message cannot be written", async () => {
    const create = db.contactEvent.create;
    db.contactEvent.create = async () => { throw new Error("crash"); };
    await send("client", "vehicles", "l_vehicleListing").expect(500);
    db.contactEvent.create = create;
    expect(await db.conversation.count()).toBe(0);
    expect(await db.message.count()).toBe(0);
    expect(await db.conversationParticipant.count()).toBe(0);
  });

  it("refuses another advertiser everywhere, and leaves nothing behind", async () => {
    const { conversationId } = (await send("client", "real_estate", "l_realEstateListing", "Message privé").expect(201)).body.data;
    for (const token of ["stranger", "rival"]) {
      await http().get(`/messages/conversations/${conversationId}`).set(as(token)).expect(403);
      await http().post(`/messages/conversations/${conversationId}/messages`).set(as(token)).send({ body: "Intrus", requestId: randomUUID() }).expect(403);
      await http().patch(`/messages/conversations/${conversationId}/read`).set(as(token)).expect(403);
      const inbox = await http().get("/messages/conversations?scope=owner&module=real_estate").set(as(token)).expect(200);
      expect(inbox.body.meta.total).toBe(0);
      const byListing = await http().get("/messages/conversations/by-listing?module=real_estate&listingId=l_realEstateListing").set(as(token)).expect(200);
      expect(byListing.body.data).toBeNull();
      const contacts = await http().get("/dashboard/contacts?module=real_estate").set(as(token)).expect(200);
      expect(contacts.body.meta.total).toBe(0);
    }
    expect(await db.message.count()).toBe(1);
  });

  it("does not show a participant the inbox of a listing they do not own", async () => {
    await db.vehicleListing.create({ data: { id: "theirs", ownerUserId: "rival", status: "active", deletedAt: null, title: "Autre", metadata: settings(open) } });
    await db.conversation.create({ data: { id: "c_x", module: "vehicles", targetType: "listing", targetId: "theirs",
      participants: { create: [{ userId: "owner" }, { userId: "rival" }] } } });
    const inbox = await http().get("/messages/conversations?scope=owner&module=vehicles").set(as("owner")).expect(200);
    expect(inbox.body.data.some((row: any) => row.id === "c_x")).toBe(false);
  });

  it("stops the client but not the owner when a listing closes, and a retry still succeeds", async () => {
    const requestId = randomUUID();
    const { conversationId } = (await send("client", "vehicles", "l_vehicleListing", "Bonjour", requestId).expect(201)).body.data;
    const secondId = randomUUID();
    await http().post(`/messages/conversations/${conversationId}/messages`).set(as("client")).send({ body: "Encore", requestId: secondId }).expect(201);
    await db.vehicleListing.update({ where: { id: "l_vehicleListing" }, data: { status: "suspended" } });
    await http().post(`/messages/conversations/${conversationId}/messages`).set(as("client")).send({ body: "Encore", requestId: secondId }).expect(201);
    await http().post(`/messages/conversations/${conversationId}/messages`).set(as("client")).send({ body: "Nouveau", requestId: randomUUID() }).expect(409);
    await http().post(`/messages/conversations/${conversationId}/messages`).set(as("owner")).send({ body: "Réponse", requestId: randomUUID() }).expect(201);
    const history = await http().get(`/messages/conversations/${conversationId}`).set(as("client")).expect(200);
    expect(history.body.data.messages.map((row: any) => row.body)).toEqual(["Bonjour", "Encore", "Réponse"]);
  });

  it("puts the conversation with the newest message first, and hides moderated messages", async () => {
    const first = (await send("client", "vehicles", "l_vehicleListing", "Un").expect(201)).body.data.conversationId;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send("client", "trips", "l_tripListing", "Deux").expect(201);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const message = await http().post(`/messages/conversations/${first}/messages`).set(as("client")).send({ body: "Trois", requestId: randomUUID() }).expect(201);
    const inbox = await http().get("/messages/conversations").set(as("client")).expect(200);
    expect(inbox.body.data[0].id).toBe(first);
    await db.message.update({ where: { id: message.body.data.id }, data: { hiddenAt: new Date() } });
    const hidden = await http().get(`/messages/conversations/${first}`).set(as("client")).expect(200);
    expect(hidden.body.data.messages.map((row: any) => row.body)).toEqual(["Un"]);
  });

  it("exposes no email or phone in conversations", async () => {
    const { conversationId } = (await send("client", "hotels", "l_hotelProperty").expect(201)).body.data;
    for (const path of [`/messages/conversations/${conversationId}`, "/messages/conversations"]) {
      const text = JSON.stringify((await http().get(path).set(as("owner")).expect(200)).body);
      expect(text).not.toContain("@example.test");
      expect(text).not.toContain("+22177");
    }
  });

  it("pages long histories from the newest", async () => {
    const { conversationId } = (await send("client", "vehicles", "l_vehicleListing", "m0").expect(201)).body.data;
    for (let index = 1; index <= 5; index++)
      await db.message.create({ data: { conversationId, senderUserId: "client", body: `m${index}`, hiddenAt: null } });
    const latest = (await http().get(`/messages/conversations/${conversationId}?limit=2`).set(as("client")).expect(200)).body.data;
    expect(latest.messages.map((row: any) => row.body)).toEqual(["m4", "m5"]);
    expect(latest.hasOlderMessages).toBe(true);
    const older = (await http().get(`/messages/conversations/${conversationId}?limit=10&before=${latest.messages[0].id}`).set(as("client")).expect(200)).body.data;
    expect(older.messages.map((row: any) => row.body)).toEqual(["m0", "m1", "m2", "m3"]);
    expect(older.hasOlderMessages).toBe(false);
  });

  describe("contacts", () => {
    async function event(data: Record<string, unknown>) {
      return db.contactEvent.create({ data: { targetType: "listing", ownerUserId: "owner", metadata: {}, ...data } });
    }

    it("pages beyond 100 without omission or repetition", async () => {
      for (let index = 0; index < 130; index++)
        await event({ module: "vehicles", source: "form", targetId: "l_vehicleListing", metadata: { clientName: `C${index}` } });
      const seen = new Set<string>();
      for (let page = 1; page <= 2; page++) {
        const result = (await http().get(`/dashboard/contacts?module=vehicles&limit=100&page=${page}`).set(as("owner")).expect(200)).body;
        expect(result.meta).toMatchObject({ total: 130, totalPages: 2 });
        result.data.forEach((row: any) => seen.add(row.id));
      }
      expect(seen.size).toBe(130);
      await http().get("/dashboard/contacts?limit=101").set(as("owner")).expect(400);
    });

    it("attaches the real request of each source, separated by source", async () => {
      await db.realEstateVisitRequest.create({ data: { id: "v1", listingId: "l_realEstateListing", clientName: "Awa", clientPhone: "770000000", clientEmail: "a@b.sn", message: "Visite", status: "new" } });
      await db.tripSeatRequest.create({ data: { id: "s1", tripId: "l_tripListing", clientName: "Modou", clientPhone: "78", requestedSeats: 2, status: "new" } });
      await event({ module: "real_estate", source: "visit_request", targetId: "l_realEstateListing", metadata: { requestId: "v1" } });
      await event({ module: "trips", source: "seat_request", targetId: "l_tripListing", metadata: { requestId: "s1" } });
      const visits = (await http().get("/dashboard/contacts?module=real_estate").set(as("owner")).expect(200)).body.data;
      expect(visits[0]).toMatchObject({ source: "visit_request", listingTitle: "Titre l_realEstateListing", details: { clientName: "Awa", clientPhone: "770000000", message: "Visite" } });
      const seats = (await http().get("/dashboard/contacts?module=trips&source=seat_request").set(as("owner")).expect(200)).body.data;
      expect(seats[0].details).toMatchObject({ clientName: "Modou", requestedSeats: 2 });
      expect((await http().get("/dashboard/contacts?module=trips&source=internal_message").set(as("owner")).expect(200)).body.meta.total).toBe(0);
    });

    it("shows older events that carry no owner, through the listing, only to its owner", async () => {
      await event({ module: "hotels", source: "reservation_request", targetId: "l_hotelProperty", ownerUserId: null });
      expect((await http().get("/dashboard/contacts?module=hotels").set(as("owner")).expect(200)).body.meta.total).toBe(1);
      expect((await http().get("/dashboard/contacts?module=hotels").set(as("rival")).expect(200)).body.meta.total).toBe(0);
    });

    it("never borrows the details of a request of another listing", async () => {
      await db.tripListing.create({ data: { id: "theirs", ownerUserId: "rival", status: "active", title: "Autre" } });
      await db.tripSeatRequest.create({ data: { id: "s2", tripId: "theirs", clientName: "Secret", clientPhone: "79", requestedSeats: 1, status: "new" } });
      await event({ module: "trips", source: "seat_request", targetId: "l_tripListing", metadata: { requestId: "s2" } });
      const rows = (await http().get("/dashboard/contacts?module=trips").set(as("owner")).expect(200)).body.data;
      expect(rows[0].details).toBeNull();
    });

    it("gives the display name of a message contact, without identifiers", async () => {
      await send("client", "vehicles", "l_vehicleListing").expect(201);
      const body = (await http().get("/dashboard/contacts?module=vehicles").set(as("owner")).expect(200)).body;
      expect(body.data[0]).toMatchObject({ source: "internal_message", details: { clientName: "Awa Diop" } });
      expect(body.data[0].clientUserId).toBeUndefined();
      expect(body.data[0].ownerUserId).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("@example.test");
    });

    it("refuses an unknown universe or source", async () => {
      await http().get("/dashboard/contacts?module=admin").set(as("owner")).expect(400);
      await http().get("/dashboard/contacts?source=clic").set(as("owner")).expect(400);
    });
  });
});
