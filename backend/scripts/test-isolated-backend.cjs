const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || '');
  if (!url.pathname.endsWith('_test') || !process.env.PRODUCTION_CLUSTER_ID)
    throw new Error('Explicit isolated test target required.');
  const prisma = new PrismaClient({
    datasources: { db: { url: url.toString() } },
    log: [],
  });
  try {
    const identity = await prisma.$queryRawUnsafe(
      'SELECT system_identifier::text AS id FROM pg_control_system()',
    );
    if (identity[0].id === process.env.PRODUCTION_CLUSTER_ID)
      throw new Error('Production tests forbidden.');
    const migrations = await prisma.$queryRawUnsafe(
      'SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied FROM _prisma_migrations ORDER BY migration_name',
    );
    console.log(JSON.stringify({ isolatedDatabaseVerified: true, migrations }));
  } finally {
    await prisma.$disconnect();
  }
  const env = { ...process.env, DATABASE_URL: url.toString() };
  for (const args of [
    [
      '--max-old-space-size=640',
      '--max-semi-space-size=4',
      'node_modules/typescript/bin/tsc',
      '-p',
      'tsconfig.json',
      '--noEmit',
      '--incremental',
      'false',
    ],
    ['node_modules/prisma/build/index.js', 'validate'],
    ['scripts/audit-migrations.cjs'],
    [
      '--max-old-space-size=320',
      '--optimize-for-size',
      'node_modules/jest/bin/jest.js',
      '--runInBand',
      '--no-cache',
      '--globals',
      JSON.stringify({ 'ts-jest': { isolatedModules: true } }),
    ],
    [
      '--test',
      'scripts/audit-migrations.test.cjs',
      'scripts/database-fingerprint.test.cjs',
    ],
  ]) {
    const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (result.status !== 0)
      throw new Error(
        `Verification failed: ${args.find((value) => value.includes('node_modules/')) || 'tooling tests'}`,
      );
  }
  console.log('ISOLATED_BACKEND_TESTS_PASSED');
}
main().catch(() => {
  console.error(
    'Isolated backend verification failed; no credentials are logged.',
  );
  process.exitCode = 1;
});
