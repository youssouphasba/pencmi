const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || '');
  if (
    !/^[a-z][a-z0-9_]*_test$/.test(url.pathname.slice(1)) ||
    !process.env.PRODUCTION_CLUSTER_ID
  ) {
    throw new Error('Explicit isolated target required');
  }
  const probe = process.argv.includes('--probe-server');
  if (probe) {
    const database = process.env.TEST_SERVER_DATABASE || 'postgres';
    if (!/^[a-z][a-z0-9_]*$/.test(database)) throw new Error('Invalid server database');
    url.pathname = '/' + database;
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: url.toString() } },
    log: [],
  });
  try {
    const identity = await prisma.$queryRawUnsafe(
      'SELECT system_identifier::text AS cluster FROM pg_control_system()',
    );
    if (identity[0].cluster === process.env.PRODUCTION_CLUSTER_ID)
      throw new Error('Production cluster forbidden');
    if (probe) {
      console.log('ISOLATED_SERVER_VERIFIED');
      return;
    }
    if (process.argv.includes('--cleanup')) {
      await prisma.$executeRawUnsafe(
        'DROP TABLE pencmi_backup_transport.archive',
      );
      await prisma.$executeRawUnsafe('DROP SCHEMA pencmi_backup_transport');
      console.log('TRANSPORT_REMOVED');
      return;
    }
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const archive = Buffer.from(
      Buffer.concat(chunks).toString('utf8').trim(),
      'base64',
    );
    try {
      if (
        archive.subarray(0, 5).toString() !== 'PGDMP' ||
        createHash('sha256').update(archive).digest('hex').toUpperCase() !==
          process.env.BACKUP_SHA256
      ) {
        throw new Error('Invalid archive');
      }
      await prisma.$transaction(async (tx) => {
        const tables = await tx.$queryRawUnsafe(
          "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
        );
        if (tables[0].count !== 0) throw new Error('Empty database required');
        await tx.$executeRawUnsafe('CREATE SCHEMA pencmi_backup_transport');
        await tx.$executeRawUnsafe(
          'CREATE TABLE pencmi_backup_transport.archive (payload bytea NOT NULL)',
        );
        await tx.$executeRawUnsafe(
          'INSERT INTO pencmi_backup_transport.archive(payload) VALUES ($1)',
          archive,
        );
      });
      console.log('TRANSPORT_READY');
    } finally {
      archive.fill(0);
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Isolated backup transport failed; no credentials or archive content are logged.',
  );
  process.exitCode = 1;
});
