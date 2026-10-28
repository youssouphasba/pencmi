const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(rows) {
  const queries = [];
  let disconnected = false;
  class PrismaClient {
    async $transaction(callback) {
      return callback({
        $executeRawUnsafe: async sql => {
          assert.match(sql, /^SET (TRANSACTION READ ONLY|LOCAL )/);
          queries.push(sql);
        },
        $queryRawUnsafe: async sql => {
          assert.match(sql, /^SELECT /);
          queries.push(sql);
          if (sql.includes('information_schema.columns')) return [
            { table_name: 'RefreshToken', column_name: 'tokenHash' },
            { table_name: 'RefreshToken', column_name: 'consumedAt' },
            { table_name: 'RefreshToken', column_name: 'parentTokenId' },
            { table_name: 'AdvertiserReview', column_name: 'id' },
            { table_name: '_prisma_migrations', column_name: 'id' },
            { table_name: 'Quoted"Table', column_name: 'snapshot' },
          ];
          return rows.map(row => ({ row }));
        },
      });
    }
    async $disconnect() { disconnected = true; }
  }
  const module = { exports: {} };
  const load = name => name === '@prisma/client' ? { PrismaClient } : require(name);
  vm.runInNewContext(fs.readFileSync(require.resolve('./database-fingerprint.cjs'), 'utf8'), {
    require: load, module, process: { env: {} }, Buffer, console,
  });
  return { fingerprint: module.exports.fingerprint, queries, disconnected: () => disconnected };
}

test('fingerprints are independent of row order and do not expose raw values', async () => {
  const a = fixture(['{"f1":"secret-fixture-a"}', '{"f1":"secret-fixture-b"}']);
  const b = fixture(['{"f1":"secret-fixture-b"}', '{"f1":"secret-fixture-a"}']);
  const first = await a.fingerprint('unused');
  const second = await b.fingerprint('unused');
  assert.equal(first.sha256, second.sha256);
  assert.equal(JSON.stringify(first).includes('secret-fixture'), false);
  assert.equal(first.tables.RefreshToken.rows, 2);
  assert.ok(a.disconnected());
});
test('changed or missing rows change the fingerprint', async () => {
  const original = await fixture(['{"f1":"value"}']).fingerprint('unused');
  assert.notEqual(original.sha256, (await fixture([]).fingerprint('unused')).sha256);
  assert.notEqual(original.sha256, (await fixture(['{"f1":"other"}']).fingerprint('unused')).sha256);
});
test('legacy comparison excludes only migration metadata and newly added fields', async () => {
  const audit = fixture([]);
  const result = await audit.fingerprint('unused');
  assert.deepEqual(Object.keys(result.tables).sort(), ['Quoted"Table', 'RefreshToken']);
  const selects = audit.queries.filter(sql => sql.includes('row_to_json'));
  assert.equal(selects.length, 2);
  assert.ok(selects.every(sql => sql.includes('row_to_json(ROW(snapshot.*))')));
  assert.ok(selects.some(sql => sql.includes('public."Quoted""Table"')));
  assert.ok(selects.every(sql => !sql.includes('consumedAt') && !sql.includes('parentTokenId')));
  assert.equal(audit.queries[0], 'SET TRANSACTION READ ONLY');
});
