import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

test("real browser auth and admin tabs share one refresh using Web Locks", { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let refreshes = 0;
  const files = new Map([
    ["/auth/token-session.mjs", new URL("../auth/token-session.mjs", import.meta.url)],
    ["/auth/auth.js", new URL("../auth/auth.js", import.meta.url)],
    ["/admin/admin.js", new URL("../admin/admin.js", import.meta.url)],
  ]);
  const server = createServer(async (req, res) => {
    try {
      if (files.has(req.url)) {
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(await readFile(files.get(req.url)));
      } else if (req.url === "/auth-tab" || req.url === "/admin-tab") {
        const script = req.url === "/auth-tab" ? "/auth/auth.js" : "/admin/admin.js";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><html><body><input id="draft" value="Contenu conservé"><script>window.PencmiConfig={apiBaseUrl:location.origin+"/api/v1"}</script><script src="${script}" defer></script></body></html>`);
      } else if (req.url === "/api/v1/auth/refresh") {
        refreshes++;
        let body = "";
        for await (const chunk of req) body += chunk;
        if (JSON.parse(body).refreshToken !== "browser-refresh-old") {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end("{}");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accessToken: "browser-access-new", refreshToken: "browser-refresh-new", tokenType: "Bearer" }));
      } else if (req.url === "/api/v1/private") {
        const allowed = req.headers.authorization === "Bearer browser-access-new";
        res.writeHead(allowed ? 200 : 401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { allowed } }));
      } else { res.writeHead(404); res.end(); }
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext();
    const auth = await context.newPage();
    const admin = await context.newPage();
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const errors = [];
    auth.on("pageerror", (error) => errors.push(error.message));
    admin.on("pageerror", (error) => errors.push(error.message));
    await auth.goto(`${baseUrl}/auth-tab`);
    await admin.goto(`${baseUrl}/admin-tab`);
    assert.equal(await auth.evaluate(() => Boolean(navigator.locks && crypto.subtle)), true);
    await auth.evaluate(() => {
      localStorage.setItem("pencmi_access_token", "browser-access-old");
      localStorage.setItem("pencmi_refresh_token", "browser-refresh-old");
    });
    const results = await Promise.all([auth, admin].map((page) => page.evaluate(() =>
      Promise.all(Array.from({ length: 12 }, () => apiRequest("/private"))))));
    assert.equal(refreshes, 1);
    assert.ok(results.flat().every((value) => value.allowed));
    assert.equal(await admin.evaluate(() => localStorage.getItem("pencmi_refresh_token")), "browser-refresh-new");
    assert.equal(await auth.locator("#draft").inputValue(), "Contenu conservé");
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
