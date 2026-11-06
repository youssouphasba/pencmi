const test = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { readFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const proxyaddr = require("proxy-addr");
const qs = require("qs");
const yaml = require("js-yaml");

function packageVersion(name, from = require) {
  try {
    return JSON.parse(
      readFileSync(from.resolve(name + "/package.json"), "utf8"),
    ).version;
  } catch (error) {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }
  let folder = dirname(from.resolve(name));
  for (;;) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(folder, "package.json"), "utf8"),
      );
      if (pkg.name === name) return pkg.version;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = dirname(folder);
    if (parent === folder) throw new Error("Package metadata not found");
    folder = parent;
  }
}

test("security floors are installed in the actual dependency resolution paths", () => {
  const expressRequire = createRequire(require.resolve("express"));
  assert.equal(packageVersion("proxy-addr", expressRequire), "2.0.8");
  assert.equal(packageVersion("body-parser", expressRequire), "2.4.0");
  assert.equal(packageVersion("qs", expressRequire), "6.17.1");
  assert.equal(packageVersion("js-yaml"), "5.5.0");
  const prismaRequire = createRequire(require.resolve("@prisma/config"));
  assert.equal(packageVersion("deepmerge-ts", prismaRequire), "8.0.2");
  assert.equal(packageVersion("@prisma/client"), "6.19.3");
  assert.equal(packageVersion("prisma"), "6.19.3");
});

test("mapped IPv6 trust subnets do not authorize an unrelated IPv4 sender", () => {
  const req = {
    socket: { remoteAddress: "198.51.100.20" },
    headers: { "x-forwarded-for": "203.0.113.10" },
  };
  for (const cidr of [
    "::ffff:10.0.0.0/8",
    "::/1",
    "10.0.0.0/8",
    "::ffff:10.0.0.0/104",
  ]) {
    assert.equal(proxyaddr(req, proxyaddr.compile(cidr)), "198.51.100.20");
  }
  req.socket.remoteAddress = "::ffff:10.1.2.3";
  assert.equal(
    proxyaddr(req, proxyaddr.compile("::ffff:10.0.0.0/104")),
    "203.0.113.10",
  );
});

test("qs preserves forms and does not pollute object prototypes", () => {
  assert.deepEqual(qs.parse("profile[city]=Dakar"), {
    profile: { city: "Dakar" },
  });
  qs.parse("__proto__[polluted]=yes&constructor[prototype][polluted]=yes");
  assert.equal({}.polluted, undefined);
  assert.throws(
    () =>
      qs.parse("a=1&b=2&c=3", {
        parameterLimit: 2,
        throwOnLimitExceeded: true,
      }),
    RangeError,
  );
});

test("patched YAML retains load/dump contracts needed by Swagger and build tools", () => {
  const source = {
    openapi: "3.0.0",
    info: { title: "Pencmi", version: "1" },
    paths: {
      "/health": { get: { responses: { 200: { description: "OK" } } } },
    },
  };
  assert.deepEqual(yaml.load(yaml.dump(source)), source);
  assert.throws(() => yaml.load("value: [unterminated"));
});

test("scoped deepmerge supports plain configuration, dates and recursive graphs without stack exhaustion", () => {
  const fromPrisma = createRequire(require.resolve("@prisma/config"));
  const { deepmerge } = fromPrisma("deepmerge-ts");
  const first = {
    migrations: { path: "migrations" },
    tags: ["first"],
    enabled: true,
  };
  const second = {
    migrations: { seed: "node seed.cjs" },
    tags: ["second"],
    enabled: false,
  };
  assert.deepEqual(deepmerge(first, second), {
    migrations: { path: "migrations", seed: "node seed.cjs" },
    tags: ["first", "second"],
    enabled: false,
  });
  assert.deepEqual(first, {
    migrations: { path: "migrations" },
    tags: ["first"],
    enabled: true,
  });
  const left = {},
    right = {};
  left.self = left;
  right.self = right;
  const result = deepmerge(left, right);
  assert.equal(result.self, result);
});

test("Prisma 6 loads an actual CommonJS config through its patched merger", async () => {
  const { loadConfigFromFile } = require("@prisma/config");
  const result = await loadConfigFromFile({
    configRoot: resolve(__dirname, "../test/fixtures/security"),
    configFile: "prisma.config.cjs",
  });
  assert.equal(result.error, undefined);
  assert.equal(
    result.config.schema,
    resolve(__dirname, "../prisma/schema.prisma"),
  );
  assert.equal(
    result.config.migrations.path,
    resolve(__dirname, "../prisma/migrations"),
  );
});
