const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readSeedPassword, SeedCredentialsError } = require('./seed-credentials.cjs');

test('seed credentials have no default and reject missing, weak or oversized values without printing them', () => {
  const name = 'PENCMI_DEMO_AGENCY_PASSWORD';
  for (const value of [undefined, '', randomBytes(2).toString('hex'), randomBytes(80).toString('hex')]) {
    assert.throws(() => readSeedPassword(name, { [name]: value }), (error) => {
      assert.ok(error instanceof SeedCredentialsError);
      assert.ok(error.message.includes(name));
      if (value) assert.ok(!error.message.includes(value));
      return true;
    });
  }
});

test('seed credentials are supplied by the environment without trimming or fallback', () => {
  const name = 'PENCMI_DEMO_CLIENT_PASSWORD';
  const value = randomBytes(24).toString('base64url') + ['A', 'a', '7', '!'].join('');
  assert.equal(readSeedPassword(name, { [name]: value }), value);
});

for (const filename of ['seed-public-showcase.cjs', 'seed-real-estate-demo.cjs']) {
  test(`${filename}: missing credentials fail before cleanup or any database access`, async () => {
    const calls = [];
    const output = [];
    let disconnected = false;
    const processStub = { env: {}, argv: ['node', filename], exitCode: undefined };
    const prismaModule = require('@prisma/client');
    class ForbiddenDatabase {
      constructor() {
        return new Proxy(this, {
          get(_target, key) {
            if (key === '$disconnect') return async () => { disconnected = true; };
            calls.push(String(key));
            throw new Error('Unexpected database access');
          },
        });
      }
    }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, filename), 'utf8'), {
      require(name) {
        if (name === 'fs') return { ...fs, existsSync: () => false };
        if (name === '@prisma/client') return { ...prismaModule, PrismaClient: ForbiddenDatabase };
        if (name === './seed-credentials.cjs') return { readSeedPassword, SeedCredentialsError };
        return require(name);
      },
      __dirname,
      process: processStub,
      console: { log: (...args) => output.push(args.join(' ')), error: (...args) => output.push(args.join(' ')) },
      Buffer,
    });
    for (let attempt = 0; attempt < 20 && !disconnected; attempt++) await new Promise(setImmediate);
    assert.equal(disconnected, true);
    assert.equal(processStub.exitCode, 1);
    assert.deepEqual(calls, []);
    assert.match(output.join('\n'), /PENCMI_.*_PASSWORD/);
  });
}
