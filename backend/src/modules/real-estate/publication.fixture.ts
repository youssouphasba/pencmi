import { randomUUID } from 'crypto';

export function publicationDatabase() {
  let listings: any[] = [];
  let assets: any[] = [];
  const match = (row: any, where: any) =>
    Object.entries(where || {}).every(([key, value]: [string, any]) => {
      if (value === undefined) return true;
      if (key === 'usages')
        return row.usages?.some((usage: any) => match(usage, value.some));
      if (value && typeof value === 'object' && 'not' in value)
        return row[key] !== value.not;
      if (value && typeof value === 'object' && 'in' in value)
        return value.in.includes(row[key]);
      return row[key] === value;
    });
  const model = (source: () => any[]) => ({
    findFirst: jest.fn(
      async ({ where }: any) =>
        source().find((row) => match(row, where)) || null,
    ),
    findFirstOrThrow: jest.fn(async ({ where }: any) => {
      const row = source().find((item) => match(item, where));
      if (!row) throw new Error('not found');
      return row;
    }),
    findMany: jest.fn(async ({ where, skip = 0, take }: any) =>
      source()
        .filter((row) => match(row, where))
        .slice(skip, take === undefined ? undefined : skip + take),
    ),
    count: jest.fn(
      async ({ where }: any) =>
        source().filter((row) => match(row, where)).length,
    ),
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: randomUUID(),
        deletedAt: null,
        status: 'draft',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...structuredClone(data),
      };
      if (row.usages?.create)
        row.usages = [{ ...row.usages.create, fileId: row.id }];
      source().push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = source().find((item) => match(item, where));
      if (!row) throw new Error('not found');
      Object.assign(row, structuredClone(data));
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const rows = source().filter((row) => match(row, where));
      rows.forEach((row) => Object.assign(row, structuredClone(data)));
      return { count: rows.length };
    }),
    aggregate: jest.fn(async ({ where }: any) => ({
      _sum: {
        sizeBytes: source()
          .filter((row) => match(row, where))
          .reduce((sum, row) => sum + row.sizeBytes, 0),
      },
    })),
  });
  const listingModel = model(() => listings);
  const prisma: any = {
    realEstateListing: {
      ...listingModel,
      upsert: jest.fn(
        async ({ where, create }: any) =>
          listings.find((row) => match(row, where)) ||
          listingModel.create({ data: create }),
      ),
    },
    fileAsset: model(() => assets),
    fileUsage: {
      findFirst: jest.fn(
        async ({ where }: any) =>
          assets
            .flatMap((row) => row.usages || [])
            .find((row) => match(row, where)) || null,
      ),
    },
    $queryRaw: jest.fn(async () => []),
  };
  let queue = Promise.resolve();
  prisma.$transaction = jest.fn((work: any) => {
    const run = queue.then(async () => {
      const beforeListings = structuredClone(listings),
        beforeAssets = structuredClone(assets);
      try {
        return await work(prisma);
      } catch (error) {
        listings = beforeListings;
        assets = beforeAssets;
        throw error;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  });
  return { prisma, listings: () => listings, assets: () => assets };
}
