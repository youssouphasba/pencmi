import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createTokenSession } from "../auth/token-session.mjs";

const { IDBFactory } = createRequire(new URL("../backend/package.json", import.meta.url))("fake-indexeddb");

const ACCESS = "pencmi_access_token";
const REFRESH = "pencmi_refresh_token";
async function attempts(platform, record) {
  const db = await new Promise((resolve, reject) => {
    const request = platform.indexedDB.open("pencmi-auth-refresh", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("attempts", { keyPath: "fingerprint" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("attempts", record ? "readwrite" : "readonly");
      const request = record ? tx.objectStore("attempts").put(record) : tx.objectStore("attempts").getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = reject;
    });
  } finally { db.close(); }
}

function environment() {
  const values = new Map([[ACCESS, "access-old"], [REFRESH, "refresh-old"], ["pencmi_current_session", "cached-user"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  let queue = Promise.resolve();
  const locks = { request(_name, _options, operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  } };
  const platform = { localStorage: storage, crypto: webcrypto, indexedDB: new IDBFactory(), navigator: { locks, onLine: true },
    setTimeout, clearTimeout, fetch: async () => json({ accessToken: "access-new", refreshToken: "refresh-new", tokenType: "Bearer" }) };
  return { platform, storage, tab: () => ({ ...platform, navigator: { ...platform.navigator } }) };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function scriptContext(sourcePath, platform) {
  const coordinator = createTokenSession(platform);
  const window = { ...platform, PencmiTokenSession: coordinator, PencmiConfig: { apiBaseUrl: "https://api.example.test/api/v1" },
    location: { protocol: "https:", hostname: "example.test", origin: "https://example.test", pathname: "/compte", search: "" } };
  const context = vm.createContext({ window, fetch: (...args) => platform.fetch(...args), Headers, FormData, URL, URLSearchParams,
    document: { body: { dataset: {} }, addEventListener() {}, querySelector() { return null; } } });
  vm.runInContext(await readFile(new URL(sourcePath, import.meta.url), "utf8"), context);
  return context;
}

test("same-tab simultaneous refresh calls share one operation", async () => {
  const { platform } = environment();
  let requests = 0;
  platform.fetch = async () => { requests++; return json({ accessToken: "access-new", refreshToken: "refresh-new" }); };
  const session = createTokenSession(platform);
  const results = await Promise.all(Array.from({ length: 20 }, () => session.refresh("https://api.example.test", "access-old")));
  assert.equal(requests, 1);
  assert.ok(results.every((value) => value.refreshToken === "refresh-new"));
});

test("separate tabs coordinate through the same origin lock", async () => {
  const env = environment();
  let requests = 0;
  env.platform.fetch = async () => { requests++; return json({ accessToken: "access-new", refreshToken: "refresh-new" }); };
  const tabs = [createTokenSession(env.tab()), createTokenSession(env.tab())];
  await Promise.all(tabs.map((session) => session.refresh("https://api.example.test", "access-old")));
  assert.equal(requests, 1);
  assert.equal(env.storage.getItem(REFRESH), "refresh-new");
});

test("durable fingerprint history prevents replay even when another tab's localStorage view is stale", async () => {
  const env = environment();
  let requests = 0;
  env.platform.fetch = async () => { requests++; return json({ accessToken: "access-new", refreshToken: "refresh-new" }); };
  await createTokenSession(env.platform).refresh("https://api.example.test", "access-old");
  let stale = true;
  const oldTab = env.tab();
  oldTab.localStorage = { ...env.storage, getItem: (key) => stale && key === ACCESS ? "access-old" : stale && key === REFRESH ? "refresh-old" : env.storage.getItem(key) };
  const timer = setTimeout(() => { stale = false; }, 40);
  try {
    const result = await createTokenSession(oldTab).refresh("https://api.example.test", "access-old");
    assert.equal(result.refreshToken, "refresh-new");
    assert.equal(requests, 1);
  } finally { clearTimeout(timer); }
});

for (const script of ["../auth/auth.js", "../admin/admin.js"]) {
  test(`${script}: simultaneous 401 responses cause a single refresh`, async () => {
    const { platform } = environment();
    let refreshes = 0;
    platform.fetch = async (url, options) => {
      if (url.endsWith("/auth/refresh")) { refreshes++; return json({ accessToken: "access-new", refreshToken: "refresh-new" }); }
      const token = new Headers(options.headers).get("Authorization");
      return token === "Bearer access-new" ? json({ data: { allowed: true } }) : json({ message: "Expired" }, 401);
    };
    const context = await scriptContext(script, platform);
    const results = await Promise.all(Array.from({ length: 12 }, () => vm.runInContext("apiRequest('/protected')", context)));
    assert.equal(refreshes, 1);
    assert.ok(results.every((result) => result.allowed));
  });
}

test("auth and admin tabs never refresh the same token independently", async () => {
  const env = environment();
  let refreshes = 0;
  env.platform.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      assert.equal(JSON.parse(options.body).refreshToken, "refresh-old");
      return json({ accessToken: "access-new", refreshToken: "refresh-new" });
    }
    return new Headers(options.headers).get("Authorization") === "Bearer access-new" ? json({ data: { allowed: true } }) : json({}, 401);
  };
  const auth = await scriptContext("../auth/auth.js", env.tab());
  const admin = await scriptContext("../admin/admin.js", env.tab());
  await Promise.all([vm.runInContext("apiRequest('/protected')", auth), vm.runInContext("apiRequest('/protected')", admin)]);
  assert.equal(refreshes, 1);
});

test("a delayed 401 reuses credentials already replaced by another refresh", async () => {
  const env = environment();
  const response = deferred();
  let requests = 0;
  env.platform.fetch = async (url, options) => {
    if (url.endsWith("/auth/refresh")) { requests++; return json({ accessToken: "access-new", refreshToken: "refresh-new" }); }
    return new Headers(options.headers).get("Authorization") === "Bearer access-old" ? response.promise : json({ data: { allowed: true } });
  };
  const auth = await scriptContext("../auth/auth.js", env.platform);
  const pending = vm.runInContext("apiRequest('/protected')", auth);
  await createTokenSession(env.tab()).refresh("https://api.example.test", "access-old");
  response.resolve(json({}, 401));
  assert.equal((await pending).allowed, true);
  assert.equal(requests, 1);
});

for (const status of [200, 401]) {
  test(`late refresh HTTP ${status} cannot overwrite or clear a newer login`, async () => {
    const { platform, storage } = environment();
    const pending = deferred();
    const started = deferred();
    platform.fetch = async () => { started.resolve(); return pending.promise; };
    const session = createTokenSession(platform);
    const operation = session.refresh("https://api.example.test", "access-old");
    await started.promise;
    storage.setItem(ACCESS, "another-login-access");
    storage.setItem(REFRESH, "another-login-refresh");
    pending.resolve(json({ accessToken: "stale-access", refreshToken: "stale-refresh" }, status));
    assert.equal((await operation).accessToken, "another-login-access");
    assert.equal(storage.getItem(REFRESH), "another-login-refresh");
  });
}

test("a delayed JSON body cannot overwrite credentials changed after response headers", async () => {
  const { platform, storage } = environment();
  const body = deferred();
  const started = deferred();
  platform.fetch = async () => ({ ok: true, status: 200, json: () => { started.resolve(); return body.promise; } });
  const operation = createTokenSession(platform).refresh("https://api.example.test", "access-old");
  await started.promise;
  storage.setItem(ACCESS, "new-login");
  storage.setItem(REFRESH, "new-login-refresh");
  body.resolve({ accessToken: "late", refreshToken: "late-refresh" });
  await operation;
  assert.equal(storage.getItem(ACCESS), "new-login");
});

test("logout during refresh does not resurrect local credentials", async () => {
  const { platform, storage } = environment();
  const pending = deferred();
  const started = deferred();
  platform.fetch = async () => { started.resolve(); return pending.promise; };
  const operation = createTokenSession(platform).refresh("https://api.example.test", "access-old");
  await started.promise;
  storage.removeItem(ACCESS);
  storage.removeItem(REFRESH);
  pending.resolve(json({ accessToken: "late", refreshToken: "late-refresh" }));
  await assert.rejects(operation, (error) => error.code === "SESSION_CHANGED");
  assert.equal(storage.getItem(REFRESH), null);
});

test("network uncertainty retains credentials and prevents retrying the possibly consumed token", async () => {
  const env = environment();
  let requests = 0;
  env.platform.fetch = async () => { requests++; throw new TypeError("Network unavailable"); };
  await assert.rejects(createTokenSession(env.platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "REFRESH_UNCERTAIN");
  assert.equal(env.storage.getItem(ACCESS), "access-old");
  assert.equal(env.storage.getItem(REFRESH), "refresh-old");
  assert.equal(env.storage.getItem("pencmi_current_session"), "cached-user");
  assert.ok(!JSON.stringify(await attempts(env.platform)).includes("refresh-old"));
  await assert.rejects(createTokenSession(env.tab()).refresh("https://api.example.test", "access-old"), (error) => error.code === "REFRESH_UNCERTAIN");
  assert.equal(requests, 1);
});

test("offline detection permits a safe retry once the network returns", async () => {
  const { platform, storage } = environment();
  platform.navigator.onLine = false;
  const session = createTokenSession(platform);
  await assert.rejects(session.refresh("https://api.example.test", "access-old"), (error) => error.code === "NETWORK_UNAVAILABLE");
  assert.equal((await attempts(platform)).length, 0);
  platform.navigator.onLine = true;
  assert.equal((await session.refresh("https://api.example.test", "access-old")).refreshToken, "refresh-new");
});

test("a confirmed invalid session clears only credentials, preserving unsaved non-sensitive data", async () => {
  const { platform, storage } = environment();
  storage.setItem("pencmi_listing_draft", "draft-content");
  platform.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(createTokenSession(platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "SESSION_INVALID");
  assert.equal(storage.getItem(ACCESS), null);
  assert.equal(storage.getItem(REFRESH), null);
  assert.equal(storage.getItem("pencmi_current_session"), null);
  assert.equal(storage.getItem("pencmi_listing_draft"), "draft-content");
});

test("unsupported coordination fails closed without clearing credentials or sending a refresh", async () => {
  const { platform, storage } = environment();
  delete platform.navigator.locks;
  platform.fetch = async () => assert.fail("No refresh is safe without coordination");
  await assert.rejects(createTokenSession(platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "COORDINATION_UNAVAILABLE");
  assert.equal(storage.getItem(REFRESH), "refresh-old");
});

test("an IndexedDB failure prevents sending a refresh token", async () => {
  const { platform, storage } = environment();
  platform.indexedDB = { open() {
    const request = {};
    queueMicrotask(() => request.onerror());
    return request;
  } };
  platform.fetch = async () => assert.fail("No request is safe without a durable attempt marker");
  await assert.rejects(createTokenSession(platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "COORDINATION_UNAVAILABLE");
  assert.equal(storage.getItem(REFRESH), "refresh-old");
});

test("a server error retains credentials without automatically replaying the request", async () => {
  const { platform, storage } = environment();
  platform.fetch = async () => json({}, 503);
  await assert.rejects(createTokenSession(platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "REFRESH_UNCERTAIN");
  assert.equal(storage.getItem(REFRESH), "refresh-old");
});

test("a crashed tab's pending marker prevents accidental replay in a new tab", async () => {
  const { platform, storage } = environment();
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode("refresh-old"));
  const fingerprint = Buffer.from(digest).toString("hex");
  await attempts(platform, { id: "abandoned", fingerprint, state: "pending" });
  platform.fetch = async () => assert.fail("A potentially consumed token must not be resent");
  await assert.rejects(createTokenSession(platform).refresh("https://api.example.test", "access-old"), (error) => error.code === "REFRESH_UNCERTAIN");
});

test("session loading does not erase credentials after a transient protected API failure", async () => {
  const { platform, storage } = environment();
  platform.fetch = async () => { throw new TypeError("Network unavailable"); };
  const context = await scriptContext("../auth/auth.js", platform);
  await vm.runInContext("loadCurrentSession()", context);
  assert.equal(storage.getItem(REFRESH), "refresh-old");
  assert.equal(storage.getItem("pencmi_current_session"), "cached-user");
});

test("login token installation waits for an ongoing refresh and wins over its late response", async () => {
  const { platform, storage } = environment();
  const pending = deferred();
  const started = deferred();
  platform.fetch = async () => { started.resolve(); return pending.promise; };
  const firstTab = createTokenSession(platform);
  const otherTab = createTokenSession({ ...platform });
  const refreshing = firstTab.refresh("https://api.example.test", "access-old");
  await started.promise;
  const login = otherTab.install({ accessToken: "login-access", refreshToken: "login-refresh" });
  pending.resolve(json({ accessToken: "rotated-access", refreshToken: "rotated-refresh" }));
  await Promise.all([refreshing, login]);
  assert.equal(storage.getItem(ACCESS), "login-access");
  assert.equal(storage.getItem(REFRESH), "login-refresh");
});

test("a new login durably supersedes old credentials even in a stale tab", async () => {
  const env = environment();
  await createTokenSession(env.platform).install({ accessToken: "login-access", refreshToken: "login-refresh" });
  let stale = true;
  const oldTab = env.tab();
  oldTab.localStorage = { ...env.storage, getItem: (key) => stale && key === ACCESS ? "access-old" : stale && key === REFRESH ? "refresh-old" : env.storage.getItem(key) };
  oldTab.fetch = async () => assert.fail("Old credentials must not be resent after a new login");
  const session = createTokenSession(oldTab);
  assert.equal(await session.invalidate({ accessToken: "access-old", refreshToken: "refresh-old" }), false);
  assert.equal(env.storage.getItem(REFRESH), "login-refresh");
  const timer = setTimeout(() => { stale = false; }, 40);
  try {
    assert.equal((await session.refresh("https://api.example.test", "access-old")).accessToken, "login-access");
  } finally { clearTimeout(timer); }
});
