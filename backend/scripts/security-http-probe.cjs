const assert = require("node:assert/strict");
const { gzipSync } = require("node:zlib");

async function main() {
  const target = new URL(process.argv[2] || "");
  if (
    target.protocol !== "https:" ||
    !/^security-stage12-tests-[a-z0-9-]+\.up\.railway\.app$/.test(
      target.hostname,
    ) ||
    target.pathname !== "/api/v1"
  )
    throw new Error("Explicit isolated security recipe URL required.");
  const results = [];
  async function check(path, status, options, code) {
    const response = await fetch(target.href + path, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, status, `${path}: unexpected HTTP status`);
    if (code) assert.equal((await response.json()).error.code, code);
    results.push({ path, status });
    return response;
  }
  const health = await check("/health", 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  for (const path of [
    "/immobilier",
    "/hotels",
    "/voitures",
    "/voyages",
    "/docs-json",
    "/docs-yaml",
  ])
    await check(path, 200);
  for (const path of ["/admin/users", "/dashboard/voyages/statistics"])
    await check(path, 401);
  const partner = await fetch(
    target.origin + "/api/hotel-partner/v1/property/nonexistent",
    { signal: AbortSignal.timeout(15000) },
  );
  assert.equal(partner.status, 401);
  results.push({
    path: "/api/hotel-partner/v1/property/nonexistent",
    status: 401,
  });
  const allowed = await check("/health", 200, {
    headers: { Origin: "https://frontend.example.test" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://frontend.example.test",
  );
  await check("/health", 403, {
    headers: { Origin: "https://untrusted.example.test" },
  });
  await check("/health", 403, {
    headers: { Origin: "http://192.168.1.99:3001" },
  });
  const headers = { "Content-Type": "application/json" };
  await check(
    "/auth/login",
    413,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ input: "x".repeat(102400) }),
    },
    "PAYLOAD_TOO_LARGE",
  );
  await check(
    "/auth/login",
    415,
    {
      method: "POST",
      headers: { ...headers, "Content-Encoding": "gzip" },
      body: gzipSync(Buffer.from("{}")),
    },
    "UNSUPPORTED_MEDIA_TYPE",
  );
  await check(
    "/auth/login",
    400,
    { method: "POST", headers, body: '{"invalid":' },
    "BAD_REQUEST",
  );
  console.log(
    JSON.stringify({
      isolatedHttpSecurity: "passed",
      checks: results.length,
      results,
    }),
  );
}
main().catch((error) => {
  console.error(
    "Isolated HTTP security probe failed: " +
      (error instanceof assert.AssertionError
        ? error.message
        : "request or target validation failed"),
  );
  process.exitCode = 1;
});
