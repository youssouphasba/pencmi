const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { checksumMatches, inspectHistory, auditDatabase } = require('./audit-migrations.cjs');

const name = '20261028010000_refresh_token_rotation';
const sql = 'ALTER TABLE "RefreshToken"\nADD COLUMN "consumedAt" TIMESTAMP(3);\n';
const local = [{ name, sql }];
const checksum = createHash('sha256').update(sql).digest('hex');
const emptyArtifacts = () => Object.fromEntries(['table', 'column', 'enum', 'index', 'constraint'].map(kind => [kind, new Set()]));
const applied = () => ({ migration_name: name, checksum, finished_at: new Date(), rolled_back_at: null });
const completeArtifacts = () => ({
  ...emptyArtifacts(), column: new Set(['RefreshToken.consumedAt', 'RefreshToken.parentTokenId']),
  index: new Set(['RefreshToken_parentTokenId_key']), constraint: new Set(['RefreshToken_parentTokenId_fkey']),
});

test('checksum accepts Windows/Unix newlines but not modified SQL', () => {
  assert.equal(checksumMatches(sql.replace(/\n/g, '\r\n'), checksum), true);
  assert.equal(checksumMatches(`${sql}SELECT 1;`, checksum), false);
});
test('fully absent migration is pending, not falsely applied', () => {
  const report = inspectHistory(local, [], emptyArtifacts());
  assert.equal(report.migrations[0].state, 'pending');
  assert.deepEqual(report.problems, []);
});
test('partial or unrecorded effects require manual review', () => {
  const artifacts = emptyArtifacts();
  artifacts.column.add('RefreshToken.consumedAt');
  assert.match(inspectHistory(local, [], artifacts).problems[0], /manual review/);
});
test('valid applied migration requires checksum and complete artifacts', () => {
  assert.deepEqual(inspectHistory(local, [applied()], completeArtifacts()).problems, []);
  assert.match(inspectHistory(local, [applied()], emptyArtifacts()).problems[0], /artifacts missing/);
});
test('failed, modified, duplicate and foreign migrations are detected', () => {
  assert.match(inspectHistory(local, [{ ...applied(), finished_at: null }], emptyArtifacts()).problems[0], /unfinished/);
  assert.match(inspectHistory(local, [{ ...applied(), checksum: 'invalid' }], completeArtifacts()).problems[0], /checksum/);
  assert.match(inspectHistory(local, [applied(), applied()], completeArtifacts()).problems[0], /duplicate/);
  assert.match(inspectHistory(local, [{ ...applied(), migration_name: 'unknown' }], emptyArtifacts()).problems[0], /absent from repository/);
});
test('rolled-back history is not considered applied', () => {
  const report = inspectHistory(local, [{ ...applied(), rolled_back_at: new Date() }], emptyArtifacts());
  assert.equal(report.migrations[0].state, 'pending');
  assert.deepEqual(report.problems, []);
});
test('catalogue audit executes only read-only SQL and never returns stored checksums', async () => {
  const queries = [];
  const prisma = { $transaction: async callback => callback({
    $executeRawUnsafe: async sql => {
      assert.match(sql, /^SET (TRANSACTION READ ONLY|LOCAL statement_timeout)/);
      queries.push(sql);
    },
    $queryRawUnsafe: async sql => {
      assert.match(sql, /^SELECT /);
      queries.push(sql);
      if (sql.includes('current_database()')) return [{ database: 'test', schema: 'public', read_only: 'on' }];
      if (sql.includes('to_regclass')) return [{ present: true }];
      if (sql.includes('FROM public._prisma_migrations')) return [{ ...applied(), checksum: 'never-print-this-checksum' }];
      return [];
    },
  }) };
  const result = await auditDatabase(prisma);
  assert.equal(queries[0], 'SET TRANSACTION READ ONLY');
  assert.equal(JSON.stringify(result).includes('never-print-this-checksum'), false);
});
test('missing or malformed credentials fail closed without leaking connection details', () => {
  for (const value of ['', 'sensitive-invalid-connection-value']) {
    const result = spawnSync(process.execPath, [require.resolve('./audit-migrations.cjs')], {
      env: { ...process.env, DATABASE_URL: value }, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.includes('Audit impossible'));
    assert.equal(result.stderr.includes('sensitive-invalid-connection-value'), false);
  }
});
