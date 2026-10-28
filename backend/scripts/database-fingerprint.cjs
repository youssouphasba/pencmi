const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');

const quote = (value) => '"' + value.replace(/"/g, '""') + '"';
const addedColumns = {
  HotelApiKey: ['active'],
  RefreshToken: ['consumedAt', 'parentTokenId'],
  HotelRoom: ['metadata'],
  HotelRoomAvailability: ['status'],
};

async function fingerprint(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
        const columns = await tx.$queryRawUnsafe(
          "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
        );
        const groups = new Map();
        for (const { table_name, column_name } of columns) {
          if (
            ['_prisma_migrations', 'AdvertiserReview'].includes(table_name) ||
            addedColumns[table_name]?.includes(column_name)
          )
            continue;
          if (!groups.has(table_name)) groups.set(table_name, []);
          groups.get(table_name).push(column_name);
        }
        const tables = {};
        for (const [table, names] of groups) {
          const rows = await tx.$queryRawUnsafe(
            `SELECT row_to_json(ROW(snapshot.*))::text AS row FROM (SELECT ${names.map(quote).join(', ')} FROM public.${quote(table)}) snapshot`,
          );
          const hash = createHash('sha256');
          for (const row of rows.map((item) => item.row).sort())
            hash.update(`${Buffer.byteLength(row)}:${row}`);
          tables[table] = { rows: rows.length, sha256: hash.digest('hex') };
        }
        return {
          tables,
          sha256: createHash('sha256')
            .update(JSON.stringify(tables))
            .digest('hex'),
        };
      },
      { timeout: 60000, isolationLevel: 'RepeatableRead' },
    );
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { fingerprint };
if (require.main === module) {
  if (!process.env.DATABASE_URL) {
    console.error('Explicit database target required');
    process.exitCode = 1;
  } else
    fingerprint(process.env.DATABASE_URL)
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch(() => {
        console.error(
          'Read-only data fingerprint failed; connection details are not logged.',
        );
        process.exitCode = 1;
      });
}
