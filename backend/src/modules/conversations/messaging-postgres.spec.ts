import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { ContactsService } from "../contacts/contacts.service";
import { ConversationsService } from "./conversations.service";

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)("Messaging on isolated PostgreSQL", () => {
  let db: PrismaClient, service: ConversationsService, contacts: ContactsService;
  const run = randomUUID();
  const owner = `msg-owner-${run}`, client = `msg-client-${run}`, listingId = `msg-listing-${run}`;

  beforeAll(async () => {
    expect(new URL(url as string).pathname).toMatch(/_test$/);
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new ConversationsService(db as PrismaService);
    contacts = new ContactsService(db as PrismaService);
    await db.user.createMany({ data: [
      { id: owner, role: "vehicle_dealer", firstName: "Ibra", email: `${owner}@example.test` },
      { id: client, role: "client", firstName: "Awa", email: `${client}@example.test` },
    ] });
    await db.vehicleListing.create({ data: { id: listingId, ownerUserId: owner, status: "active", slug: listingId, title: "Corolla", vehicleMode: "sale", city: "Dakar",
      metadata: { publication: { contactPreferences: { internalMessagingEnabled: true } } } } });
  });
  afterAll(async () => {
    const ids = (await db.conversation.findMany({ where: { targetId: listingId }, select: { id: true } })).map((row) => row.id);
    await db.message.deleteMany({ where: { conversationId: { in: ids } } });
    await db.conversation.deleteMany({ where: { id: { in: ids } } });
    await db.contactEvent.deleteMany({ where: { targetId: listingId } });
    await db.vehicleListing.deleteMany({ where: { id: listingId } });
    await db.user.deleteMany({ where: { id: { in: [owner, client] } } });
    await db.$disconnect();
  });

  it("really keeps one conversation, message and contact under concurrency", async () => {
    const dto = { module: "vehicles" as const, listingId, body: "Disponible ?", requestId: randomUUID() };
    const results = await Promise.all(Array.from({ length: 8 }, () => service.open(client, dto)));
    expect(new Set(results.map((row) => row.conversationId)).size).toBe(1);
    expect(await db.conversation.count({ where: { targetId: listingId } })).toBe(1);
    expect(await db.message.count({ where: { conversationId: results[0].conversationId } })).toBe(1);
    expect(await db.contactEvent.count({ where: { targetId: listingId, source: "internal_message" } })).toBe(1);
  });

  it("serves the real queries of the inbox, read state and contacts", async () => {
    const inbox = await service.findMine(owner, { scope: "owner", module: "vehicles", q: "corol", page: 1, limit: 20 });
    expect(inbox.data[0]).toMatchObject({ listingTitle: "Corolla", unreadCount: 1, counterpartName: "Awa" });
    await service.markRead(inbox.data[0].id, owner);
    const read = await service.findMine(owner, { scope: "owner", module: "vehicles", page: 1, limit: 20 });
    expect(read.data[0].unreadCount).toBe(0);
    const older = await service.findOne(inbox.data[0].id, owner, { limit: 1 });
    expect(older.messages).toHaveLength(1);
    const list = await contacts.findMine(owner, { module: "vehicles", page: 1, limit: 20 });
    expect(list.data[0]).toMatchObject({ source: "internal_message", details: { clientName: "Awa" } });
    expect((await contacts.findMine(client, { module: "vehicles", page: 1, limit: 20 })).meta.total).toBe(0);
  });
});
