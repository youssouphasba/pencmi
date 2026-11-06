import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const base = process.env.PENCMI_TEST_API_URL;
test(
  "real browser to isolated NestJS/PostgreSQL: draft, moderation, public trip and seat request",
  { skip: !base || !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 240000 },
  async () => {
    const target = new URL(base);
    assert.match(
      target.hostname,
      /^stage10-tests-[a-z0-9-]+\.up\.railway\.app$/,
    );
    assert.ok(
      process.env.PENCMI_TEST_ADMIN_PASSWORD,
      "Isolated admin credentials required.",
    );
    const call = async (path, body, token, method = "POST") => {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      assert.ok(
        response.ok,
        `${method} ${path} failed with status ${response.status}`,
      );
      return payload;
    };
    const provider = (
      await call("/auth/register", {
        role: "transport_provider",
        email: `trip-${randomUUID()}@example.test`,
        password: randomUUID(),
      })
    ).data;
    const admin = (
      await call("/auth/login", {
        identifier: "isolated-admin@example.test",
        password: process.env.PENCMI_TEST_ADMIN_PASSWORD,
      })
    ).data;
    const { chromium } = await import(
      pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href
    );
    const root = resolve(import.meta.dirname, "..");
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/config/runtime-config.js") {
          res.setHeader("Content-Type", "text/javascript");
          return res.end(
            `window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(base)}};`,
          );
        }
        const file = resolve(
          root,
          "." +
            decodeURIComponent(
              url.pathname.endsWith("/")
                ? url.pathname + "index.html"
                : url.pathname,
            ),
        );
        if (
          !file.startsWith(root + sep) ||
          file.includes(sep + "backend" + sep) ||
          !/\.(html|m?js|css|jpeg|png|svg)$/.test(file)
        ) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader(
          "Content-Type",
          /\.m?js$/.test(file)
            ? "text/javascript"
            : file.endsWith(".css")
              ? "text/css"
              : file.endsWith(".html")
                ? "text/html; charset=utf-8"
                : "image/jpeg",
        );
        res.end(await readFile(file));
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await chromium.launch({ channel: "msedge", headless: true });
      for (const width of [390, 1280]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
        });
        await context.addInitScript((tokens) => {
          localStorage.setItem("pencmi_access_token", tokens.accessToken);
          localStorage.setItem("pencmi_refresh_token", tokens.refreshToken);
        }, provider);
        const page = await context.newPage(),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("dialog", (d) => d.accept());
        await page.goto(origin + "/publier/?category=voyage");
        await page
          .locator('[data-trip-field="vehicleType"]')
          .selectOption("minibus");
        await page.locator("[data-draft-trip]").click();
        await page
          .getByText("Brouillon enregistré.", { exact: true })
          .waitFor();
        const id = new URL(page.url()).searchParams.get("id");
        assert.ok(id);
        assert.equal((await call(`/dashboard/voyages/${id}`, null, provider.accessToken, 'GET')).data.publication.vehicleType, 'minibus');
        await page.reload();
        await page.locator('[data-trip-field="vehicleType"]:not(:disabled)').waitFor();
        assert.equal(
          await page.locator('[data-trip-field="vehicleType"]').inputValue(),
          "minibus",
        );
        const fill = async (step, values) => {
          await page.locator(`[data-trip-step="${step}"]`).click();
          for (const [path, value] of Object.entries(values))
            await page.locator(`[data-trip-field="${path}"]`).fill(value);
        };
        await fill(1, {
          "route.departureCity": "Dakar",
          "route.arrivalCity": "Saint-Louis",
          "route.departurePoint": "Point convenu",
        });
        await fill(2, {
          "schedule.date": "2099-01-01",
          "schedule.departureTime": "23:00",
          "schedule.arrivalTime": "02:00",
        });
        await fill(3, { "vehicle.totalSeats": "15" });
        await fill(4, {
          "pricing.availableSeats": "10",
          "pricing.pricePerSeat": "5000",
        });
        await fill(6, {
          "content.title": `Trajet recette ${width}`,
          "content.description": "Description de recette isolée",
        });
        await page.locator('[data-trip-step="9"]').click();
        await page.locator("[data-submit-trip]").click();
        await page
          .getByText("Votre trajet est en attente de validation.", {
            exact: true,
          })
          .waitFor();
        assert.equal(
          (
            await call(
              `/dashboard/voyages/${id}`,
              null,
              provider.accessToken,
              "GET",
            )
          ).data.status,
          "pending_review",
        );
        assert.equal((await fetch(base + `/voyages/${id}`)).status, 404);
        const adminContext = await browser.newContext({
          viewport: { width, height: 900 },
        });
        await adminContext.addInitScript((tokens) => {
          localStorage.setItem("pencmi_access_token", tokens.accessToken);
          localStorage.setItem("pencmi_refresh_token", tokens.refreshToken);
        }, admin);
        const adminPage = await adminContext.newPage();
        adminPage.on("dialog", (d) => d.accept());
        await adminPage.goto(
          origin + "/admin/listings/voyages/?status=pending_review",
        );
        await adminPage
          .locator(`[data-trip-moderation="active"][data-id="${id}"]`)
          .click();
        await adminPage
          .getByText("Aucun trajet correspondant.", { exact: true })
          .waitFor();
        const publicData = (await call(`/voyages/${id}`, null, null, "GET"))
          .data;
        assert.equal(publicData.metadata.arrivalNextDay, true);
        assert.equal(publicData.ownerUserId, undefined);
        assert.equal(publicData.metadata.publication, undefined);
        await page.goto(
          origin +
            `/voyages/?depart=Dakar&arrivee=Saint-Louis&date=2099-01-01&passengers=2&vehicleType=minibus&minPrice=4900&maxPrice=5100&timeOfDay=night`,
        );
        await page.locator(".trip-card").waitFor();
        assert.match(
          await page.locator(".trip-list").innerText(),
          new RegExp(`Trajet recette ${width}|Dakar`),
        );
        await page.goto(origin + `/voyages/detail/?id=${id}`);
        await page.locator("[data-open-reservation]").click();
        await page.locator('[name="clientName"]').fill("Voyageur recette");
        await page
          .locator('[name="clientEmail"]')
          .fill("voyageur@example.test");
        await page.locator('[name="requestedSeats"]').fill("2");
        await page.locator('#trip-reservation-form [type="submit"]').click();
        await page
          .getByText("Votre demande a été reçue.", { exact: false })
          .waitFor();
        const requests = (
          await call(
            "/dashboard/voyages/seat-requests",
            null,
            provider.accessToken,
            "GET",
          )
        ).data;
        const seat = requests.find((row) => row.tripId === id);
        assert.equal(seat.requestedSeats, 2);
        assert.equal(seat.status, "new");
        assert.equal(
          (
            await call(
              `/dashboard/voyages/${id}`,
              null,
              provider.accessToken,
              "GET",
            )
          ).data.availableSeats,
          10,
        );
        await page.goto(origin + "/dashboard/voyages/reservations/");
        await page
          .locator(
            `[data-trip-request-status="pending"][data-trip-request-id="${seat.id}"]`,
          )
          .click();
        await page
          .getByRole("cell", { name: "En attente", exact: true })
          .waitFor();
        await page.goto(origin + "/dashboard/voyages/trajets/");
        await page
          .locator(`[data-trip-action="delete"][data-id="${id}"]`)
          .click();
        await page
          .getByText("Vous n’avez aucun trajet publié pour le moment.", {
            exact: true,
          })
          .waitFor();
        assert.equal((await fetch(base + `/voyages/${id}`)).status, 404);
        assert.deepEqual(errors, []);
        await adminContext.close();
        await context.close();
      }
    } finally {
      await browser?.close();
      await new Promise((done) => server.close(done));
    }
  },
);
