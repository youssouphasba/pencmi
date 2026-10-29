const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const backendDirectory = path.resolve(__dirname, '..');
const migrationsDirectory = path.join(backendDirectory, 'prisma', 'migrations');
const requiredArtifacts = {
  '20260626170000_advertiser_reviews': [
    ['table', 'AdvertiserReview'],
    ['enum', 'AdvertiserReviewStatus'],
    ...['id', 'advertiserUserId', 'reviewerUserId', 'rating', 'comment', 'module', 'targetType', 'targetId', 'status', 'createdAt', 'updatedAt', 'publishedAt', 'moderatedAt'].map(name => ['column', `AdvertiserReview.${name}`]),
    ...['AdvertiserReview_pkey', 'AdvertiserReview_advertiserUserId_fkey', 'AdvertiserReview_reviewerUserId_fkey'].map(name => ['constraint', name]),
    ...['AdvertiserReview_advertiserUserId_status_createdAt_idx', 'AdvertiserReview_reviewerUserId_createdAt_idx', 'AdvertiserReview_module_targetType_targetId_idx'].map(name => ['index', name]),
  ],
  '20261028000000_hotel_api_key_active': [['column', 'HotelApiKey.active']],
  '20261028010000_refresh_token_rotation': [
    ['column', 'RefreshToken.consumedAt'],
    ['column', 'RefreshToken.parentTokenId'],
    ['index', 'RefreshToken_parentTokenId_key'],
    ['constraint', 'RefreshToken_parentTokenId_fkey'],
  ],
  '20261029000000_hotel_publication': [
    ['column', 'HotelRoom.metadata'],
    ['column', 'HotelRoomAvailability.status'],
    ['constraint', 'HotelRoomAvailability_nonnegative'],
  ],
  '20261029010000_hotel_reservation_allocations': [
    ...['roomId', 'units', 'idempotencyKey', 'requestFingerprint'].map(name => ['column', `HotelReservationRequest.${name}`]),
    ['table', 'HotelStockAllocation'],
    ['table', 'HotelReservationEvent'],
    ...['HotelReservationRequest_roomId_fkey', 'HotelReservationRequest_stay_valid', 'HotelStockAllocation_requestId_fkey', 'HotelStockAllocation_roomId_fkey', 'HotelReservationEvent_requestId_fkey'].map(name => ['constraint', name]),
    ...['HotelReservationRequest_idempotencyKey_key', 'HotelStockAllocation_requestId_date_key', 'HotelStockAllocation_roomId_date_releasedAt_idx', 'HotelReservationEvent_requestId_createdAt_idx'].map(name => ['index', name]),
  ],
};

function checksumMatches(sql, checksum) {
  const variants = [sql, sql.replace(/\r\n/g, '\n'), sql.replace(/\r?\n/g, '\r\n')];
  return variants.some(value => createHash('sha256').update(value).digest('hex') === checksum);
}

function inspectHistory(localMigrations, history, artifacts) {
  const problems = [];
  const migrations = localMigrations.map(local => {
    const attempts = history.filter(row => row.migration_name === local.name);
    const applied = attempts.filter(row => row.finished_at && !row.rolled_back_at);
    const unfinished = attempts.filter(row => !row.finished_at && !row.rolled_back_at);
    if (applied.length > 1) problems.push(`${local.name}: duplicate applied records`);
    if (unfinished.length) problems.push(`${local.name}: unfinished or failed migration`);
    if (applied.some(row => !checksumMatches(local.sql, row.checksum))) {
      problems.push(`${local.name}: checksum mismatch`);
    }
    const checks = (requiredArtifacts[local.name] || []).map(([kind, name]) => ({
      kind, name, present: artifacts[kind].has(name),
    }));
    const presentCount = checks.filter(check => check.present).length;
    if (applied.length && presentCount !== checks.length) {
      problems.push(`${local.name}: recorded as applied but artifacts missing`);
    }
    if (!applied.length && presentCount) {
      problems.push(`${local.name}: unrecorded artifacts; manual review required`);
    }
    return {
      name: local.name,
      state: applied.length ? 'applied' : unfinished.length ? 'unfinished' : 'pending',
      checksumMatches: applied.length ? applied.every(row => checksumMatches(local.sql, row.checksum)) : null,
      artifacts: checks,
    };
  });
  for (const row of history) {
    if (!localMigrations.some(local => local.name === row.migration_name)) {
      problems.push(`${row.migration_name}: migration absent from repository`);
    }
  }
  return { migrations, problems };
}

async function auditDatabase(prisma) {
  const localMigrations = fs.readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => ({
      name: entry.name,
      sql: fs.readFileSync(path.join(migrationsDirectory, entry.name, 'migration.sql'), 'utf8'),
    })).sort((a, b) => a.name.localeCompare(b.name));
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15s'");
    const identity = await tx.$queryRawUnsafe("SELECT current_database() AS database, current_schema() AS schema, current_setting('server_version') AS version, current_setting('transaction_read_only') AS read_only");
    const historyExists = await tx.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
    const history = historyExists[0].present ? await tx.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at, started_at, applied_steps_count FROM public._prisma_migrations ORDER BY started_at') : [];
    const tables = await tx.$queryRawUnsafe("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'");
    const columns = await tx.$queryRawUnsafe("SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position");
    const indexes = await tx.$queryRawUnsafe("SELECT indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public'");
    const constraints = await tx.$queryRawUnsafe("SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public'");
    const enums = await tx.$queryRawUnsafe("SELECT t.typname AS name, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder");
    const invalidIndexes = await tx.$queryRawUnsafe("SELECT c.relname AS name FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND (NOT i.indisvalid OR NOT i.indisready)");
    const artifacts = {
      table: new Set(tables.map(row => row.name)),
      column: new Set(columns.map(row => `${row.table_name}.${row.column_name}`)),
      index: new Set(indexes.map(row => row.name)),
      constraint: new Set(constraints.map(row => row.name)),
      enum: new Set(enums.map(row => row.name)),
    };
    const inspection = inspectHistory(localMigrations, history, artifacts);
    if (!historyExists[0].present) inspection.problems.push('Migration history table missing');
    if (invalidIndexes.length) inspection.problems.push('Invalid or unfinished indexes detected');
    return {
      checkedAt: new Date().toISOString(),
      database: identity[0],
      history: history.map(({ checksum, ...row }) => row),
      ...inspection,
      expectedColumns: columns.filter(row =>
        (row.table_name === 'RefreshToken' && ['consumedAt', 'parentTokenId'].includes(row.column_name)) ||
        (row.table_name === 'HotelApiKey' && row.column_name === 'active')),
      invalidIndexes,
    };
  }, { timeout: 30000 });
}

function schemaDiff() {
  const result = spawnSync(process.execPath, [
    '--max-old-space-size=192', require.resolve('prisma/build/index.js'),
    'migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma',
    '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code',
  ], { cwd: backendDirectory, env: process.env, encoding: 'utf8', timeout: 60000, windowsHide: true });
  if (result.error || ![0, 2].includes(result.status)) {
    return { state: 'unverified', summary: 'Schema comparison failed; inspect securely without logging connection strings.' };
  }
  return { state: result.status === 0 ? 'in_sync' : 'drift', summary: result.stdout.trim() };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration required');
  const connection = new URL(process.env.DATABASE_URL);
  if (!['postgresql:', 'postgres:'].includes(connection.protocol)) throw new Error('PostgreSQL required');
  if (!connection.searchParams.has('connect_timeout')) connection.searchParams.set('connect_timeout', '5');
  if (!connection.searchParams.has('pool_timeout')) connection.searchParams.set('pool_timeout', '5');
  process.env.DATABASE_URL = connection.toString();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  try {
    const report = await auditDatabase(prisma);
    report.schemaDiff = schemaDiff();
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.problems.length || report.schemaDiff.state === 'unverified' ? 3
      : report.migrations.some(migration => migration.state !== 'applied') || report.schemaDiff.state === 'drift' ? 2 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { checksumMatches, inspectHistory, auditDatabase };
if (require.main === module) main().catch(() => {
  console.error('Audit impossible. Vérifiez la connexion et les droits en lecture ; aucun détail de connexion n’est affiché.');
  process.exitCode = 1;
});
