import { Prisma } from "@prisma/client";

/**
 * In-memory stand-in for the Prisma calls of messaging and contacts: unique ids,
 * rollback and serialized transactions behave as PostgreSQL would for these queries.
 * It is not a proof of the SQL itself: see messaging-postgres.spec.ts for that.
 */
const clone = <T>(value: T): T => structuredClone(value);
let sequence = 0;

function matches(row: any, where: any, db: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === "OR") return condition.some((item: any) => matches(row, item, db));
    if (key === "AND") return condition.every((item: any) => matches(row, item, db));
    if (key === "occurrences")
      return db.tripOccurrence.rows.some((item: any) => item.tripId === row.id && matches(item, condition.some, db));
    if (key === "metadata" && condition?.path) {
      const value = condition.path.reduce((node: any, part: string) => node?.[part], row.metadata);
      if (value === undefined || value === null) return false;
      if ("gte" in condition) return typeof value === "number" && value >= condition.gte;
      return String(value).toLowerCase().includes(String(condition.string_contains).toLowerCase());
    }
    if (key === "participants")
      return db.conversationParticipant.rows.some(
        (item: any) => item.conversationId === row.id && matches(item, condition.some, db),
      );
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("equals" in condition && String(value).toLowerCase() !== String(condition.equals).toLowerCase()) return false;
      if ("in" in condition && !condition.in.includes(value)) return false;
      if ("notIn" in condition && condition.notIn.includes(value)) return false;
      if ("not" in condition && (value ?? null) === condition.not) return false;
      if ("gt" in condition && !(value > condition.gt)) return false;
      if (condition.gte !== undefined && !(value >= condition.gte)) return false;
      if (condition.lte !== undefined && !(value <= condition.lte)) return false;
      if ("lt" in condition && !(value < condition.lt)) return false;
      if ("contains" in condition && !String(value).toLowerCase().includes(condition.contains.toLowerCase())) return false;
      return true;
    }
    if (condition instanceof Date) return value?.getTime?.() === condition.getTime();
    return (value ?? null) === condition;
  });
}

function ordered(rows: any[], orderBy: any) {
  const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).map((item: any) => Object.entries(item)[0]);
  return [...rows].sort((a, b) => {
    for (const [key, direction] of keys as [string, string][]) {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
    }
    return 0;
  });
}

function unique(field: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [field] },
  });
}

class Table {
  rows: any[] = [];
  constructor(protected db: any, private relations: Record<string, (row: any, spec: any) => any> = {}) {}

  private shape(row: any, args: any = {}) {
    const out = clone(row);
    for (const [key, spec] of Object.entries(args.include || {}))
      out[key] = this.relations[key](row, spec);
    return out;
  }
  async findUnique(args: any) {
    const row = this.rows.find((item) => matches(item, this.flat(args.where), this.db));
    return row ? this.shape(row, args) : null;
  }
  async findUniqueOrThrow(args: any) {
    const row = await this.findUnique(args);
    if (!row) throw new Error("Not found");
    return row;
  }
  async findFirst(args: any = {}) {
    const row = ordered(this.rows.filter((item) => matches(item, args.where, this.db)), args.orderBy)[0];
    return row ? this.shape(row, args) : null;
  }
  async findMany(args: any = {}) {
    let rows = ordered(this.rows.filter((item) => matches(item, args.where, this.db)), args.orderBy);
    rows = rows.slice(args.skip ?? 0, args.take ? (args.skip ?? 0) + args.take : undefined);
    return rows.map((row) => this.shape(row, args));
  }
  async count(args: any = {}) {
    return this.rows.filter((item) => matches(item, args.where, this.db)).length;
  }
  async create(args: any) {
    const { participants, ...data } = args.data;
    const id = data.id ?? `row_${String(++sequence).padStart(8, "0")}`;
    if (this.rows.some((row) => row.id === id)) throw unique("id");
    const row = { createdAt: new Date(), updatedAt: new Date(), ...data, id };
    this.rows.push(row);
    for (const participant of participants?.create ?? [])
      await this.db.conversationParticipant.create({ data: { ...participant, conversationId: id, lastReadAt: null } });
    return clone(row);
  }
  async update(args: any) {
    const row = this.rows.find((item) => matches(item, this.flat(args.where), this.db));
    if (!row) throw new Error("Record to update not found");
    Object.assign(row, args.data);
    return clone(row);
  }
  async createMany(args: any) {
    let count = 0;
    for (const data of args.data) {
      if (args.skipDuplicates && this.rows.some((row) => row.id === data.id)) continue;
      await this.create({ data });
      count++;
    }
    return { count };
  }
  async deleteMany(args: any) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, args.where, this.db));
    return { count: before - this.rows.length };
  }
  async upsert(args: any) {
    const row = this.rows.find((item) => matches(item, args.where, this.db));
    if (row) {
      Object.assign(row, args.update);
      return clone(row);
    }
    return this.create({ data: args.create });
  }
  private flat(where: any) {
    return where.conversationId_userId ?? where.userId_module_targetId ?? where;
  }
}

export function createFakePrisma() {
  const db: any = {};
  const userView = (id: string) => {
    const user = db.user.rows.find((row: any) => row.id === id);
    return user && { firstName: user.firstName, lastName: user.lastName, professionalProfile: user.professionalProfile ?? null };
  };
  db.user = new Table(db);
  db.conversationParticipant = new Table(db);
  db.contactEvent = new Table(db);
  db.message = new Table(db);
  db.conversation = new Table(db, {
    participants: (row) =>
      db.conversationParticipant.rows
        .filter((item: any) => item.conversationId === row.id)
        .map((item: any) => ({ ...clone(item), user: userView(item.userId) })),
    messages: (row, spec) => {
      let rows = ordered(
        db.message.rows.filter((item: any) => item.conversationId === row.id && matches(item, spec.where, db)),
        spec.orderBy,
      );
      if (spec.cursor) {
        const index = rows.findIndex((item: any) => item.id === spec.cursor.id);
        rows = index < 0 ? [] : rows.slice(index + (spec.skip ?? 0));
      }
      return clone(rows.slice(0, spec.take));
    },
  });
  const owner = (row: any) => {
    const user = db.user.rows.find((item: any) => item.id === row.ownerUserId);
    return { status: user?.status ?? "active", deletedAt: user?.deletedAt ?? null };
  };
  for (const name of ["realEstateListing", "vehicleListing", "tripListing", "hotelProperty"])
    db[name] = new Table(db, {
      owner,
      rooms: (row) => db.hotelRoom.rows.filter((item: any) => item.propertyId === row.id).map(clone),
      occurrences: (row, spec) => clone(ordered(db.tripOccurrence.rows.filter((item: any) => item.tripId === row.id && matches(item, spec.where, db)), spec.orderBy).slice(0, spec.take)),
    });
  for (const name of ["realEstateVisitRequest", "hotelReservationRequest", "vehicleRentalRequest", "vehicleChauffeurRequest", "tripSeatRequest", "hotelStockAllocation", "trackingEvent", "notification", "favorite", "savedAlert", "idempotencyKey", "tripOccurrence", "hotelRoom"])
    db[name] = new Table(db);
  const tables = () => Object.values(db).filter((value) => value instanceof Table) as Table[];
  let queue: Promise<unknown> = Promise.resolve();
  db.$transaction = (work: (tx: any) => Promise<unknown>) => {
    const run = queue.then(async () => {
      const snapshot = tables().map((table) => clone(table.rows));
      try {
        return await work(db);
      } catch (error) {
        tables().forEach((table, index) => (table.rows = snapshot[index]));
        throw error;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return db;
}
