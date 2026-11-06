import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, sep, join } from "node:path";
import { pathToFileURL } from "node:url";

test(
  "trip publication, resume, errors, filters, dashboard and requests on mobile and desktop",
  { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 180000 },
  async () => {
    const { chromium } = await import(
      pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href
    );
    const root = resolve(import.meta.dirname, "..");
    let origin,
      listing,
      failed = false,
      creates = 0,
      filters,
      seatRequests = 0,
      bulk = false,
      replies = 0;
    const publicTrip = () => ({
      ...listing,
      id: "public-trip",
      occurrenceId: "public-occurrence",
      title: "<img src=x onerror=alert(1)>Trajet",
      departureCity: "Dakar",
      arrivalCity: "Thiès",
      departureDate: "2099-01-01",
      departureTime: "23:00",
      vehicleType: "bus",
      availableSeats: 10,
      offeredSeats: 10,
      pricePerSeat: 3000,
      metadata: {
        description: "<b>Texte brut</b>",
        estimatedArrivalTime: "01:00",
        arrivalNextDay: true,
        contactPreferences: { reservationRequestEnabled: true },
      },
    });
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/config/runtime-config.js") {
          res.setHeader("Content-Type", "text/javascript");
          return res.end(
            `window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + "/api/v1")}}`,
          );
        }
        if (url.pathname.startsWith("/api/v1/")) {
          res.setHeader("Content-Type", "application/json");
          if (failed) {
            failed = false;
            res.statusCode = 503;
            return res.end(
              JSON.stringify({
                success: false,
                error: { message: "Erreur réseau test" },
              }),
            );
          }
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = raw ? JSON.parse(raw) : {},
            path = url.pathname.slice(7);
          let data = [],
            meta;
          if (bulk && path === "/dashboard/voyages") {
            const start = (Number(url.searchParams.get("page") || 1) - 1) * 100;
            data = Array.from(
              { length: Math.max(0, Math.min(100, 105 - start)) },
              (_, i) => ({
                id: `bulk-${start + i}`,
                title: `Trajet ${start + i}`,
                status: "draft",
                departureCity: "Dakar",
                arrivalCity: "Touba",
              }),
            );
            meta = { total: 105, totalPages: 2 };
          } else if (bulk && path === "/dashboard/voyages/seat-requests") {
            const start = (Number(url.searchParams.get("page") || 1) - 1) * 100;
            data = Array.from(
              { length: Math.max(0, Math.min(100, 105 - start)) },
              (_, i) => ({
                id: `request-${start + i}`,
                clientName: `Client ${start + i}`,
                requestedSeats: 1,
                status: "new",
                trip: { title: `Trajet ${start + i}` },
              }),
            );
            meta = { total: 105, totalPages: 2 };
          } else if (bulk && path === "/dashboard/voyages/statistics") {
            data = {
              totalRequests: 105,
              requestedSeats: 105,
              confirmedSeats: 0,
              directContacts: 1,
              inboundMessages: 1,
              requestsByStatus: { new: 105 },
              contactsBySource: { phone: 1 },
              historicalUnallocatedRequests: 0,
            };
          } else if (bulk && path === "/dashboard/voyages/contacts") {
            data = [
              {
                id: "contact",
                targetId: "bulk-104",
                source: "phone",
                createdAt: "2099-01-01",
              },
            ];
          } else if (bulk && path === "/dashboard/voyages/conversations") {
            data = [
              {
                id: "conversation",
                targetId: "bulk-104",
                messages: [{ body: "<b>Question</b>" }],
              },
            ];
          } else if (bulk && path === "/messages/conversations/conversation") {
            data = {
              id: "conversation",
              messages: [
                { body: "<b>Question</b>" },
                ...(replies ? [{ body: "Réponse envoyée" }] : []),
              ],
            };
          } else if (
            bulk &&
            path === "/messages/conversations/conversation/messages"
          ) {
            assert.match(body.requestId, /^[\da-f-]{36}$/);
            replies++;
            data = { id: "reply", body: body.body };
          } else if (path === "/dashboard/voyages" && req.method === "POST") {
            creates++;
            listing ||= {
              id: "saved-trip",
              status: "draft",
              publication: body.publication,
            };
            data = listing;
          } else if (
            path === "/dashboard/voyages/saved-trip" &&
            req.method === "PATCH"
          ) {
            listing = {
              ...listing,
              publication: body.publication,
              title: body.publication.content?.title,
              departureCity: body.publication.route?.departureCity,
              arrivalCity: body.publication.route?.arrivalCity,
              departureDate: body.publication.schedule?.date,
              departureTime: body.publication.schedule?.departureTime,
              pricePerSeat: body.publication.pricing?.pricePerSeat,
              availableSeats: body.publication.pricing?.availableSeats,
            };
            data = listing;
          } else if (path.endsWith("/saved-trip/submit")) {
            listing.status = "pending_review";
            data = listing;
          } else if (
            path === "/dashboard/voyages/saved-trip" &&
            req.method === "DELETE"
          ) {
            listing = null;
            data = { status: "deleted" };
          } else if (path === "/dashboard/voyages/saved-trip") data = listing;
          else if (path === "/dashboard/voyages") {
            data = listing ? [listing] : [];
            meta = { totalPages: 1 };
          } else if (path === "/voyages") {
            filters = Object.fromEntries(url.searchParams);
            data = [publicTrip()];
            meta = { total: 1, totalPages: 2 };
          } else if (path === "/voyages/public-trip") data = publicTrip();
          else if (path === "/voyages/public-trip/seat-requests") {
            assert.match(body.requestId, /^[\da-f-]{36}$/);
            seatRequests++;
            data = { id: "seat", status: "new" };
          }
          res.end(JSON.stringify({ success: true, data, meta }));
          return;
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
      } catch (error) {
        res.statusCode = 500;
        res.end();
      }
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await chromium.launch({ channel: "msedge", headless: true });
      for (const width of [360, 390, 768, 1280]) {
        listing = null;
        creates = 0;
        const page = await browser.newPage({
            viewport: { width, height: 900 },
          }),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("dialog", (d) => d.accept());
        await page.addInitScript(() =>
          localStorage.setItem("pencmi_access_token", "test-token"),
        );
        await page.goto(origin + "/publier/?category=voyage");
        await page
          .locator('[data-trip-field="vehicleType"]')
          .selectOption("bus");
        await page.locator("[data-draft-trip]").click();
        await page
          .getByText("Brouillon enregistré.", { exact: true })
          .waitFor();
        assert.equal(creates, 1);
        await page.reload();
        await page.locator('[data-trip-field="vehicleType"]').waitFor();
        assert.equal(
          await page.locator('[data-trip-field="vehicleType"]').inputValue(),
          "bus",
        );
        const fill = async (step, values) => {
          await page.locator(`[data-trip-step="${step}"]`).click();
          for (const [path, value] of Object.entries(values))
            await page.locator(`[data-trip-field="${path}"]`).fill(value);
        };
        await fill(1, {
          "route.departureCity": "Dakar",
          "route.arrivalCity": "Thiès",
          "route.departurePoint": "Gare",
        });
        await fill(2, {
          "schedule.date": "2099-01-01",
          "schedule.departureTime": "23:00",
          "schedule.arrivalTime": "01:00",
        });
        await fill(3, {
          "vehicle.totalSeats": "20",
          "vehicle.brand": "Marque",
        });
        await fill(4, {
          "pricing.availableSeats": "10",
          "pricing.pricePerSeat": "3000",
        });
        await fill(6, {
          "content.title": "<b>Trajet</b>",
          "content.description": "Description du trajet",
        });
        failed = true;
        await page.locator("[data-draft-trip]").click();
        await page.getByText("Erreur réseau test", { exact: true }).waitFor();
        assert.equal(
          await page.locator('[data-trip-field="content.title"]').inputValue(),
          "<b>Trajet</b>",
        );
        await page.locator("[data-preview-trip]").click();
        assert.equal(await page.locator(".preview-box b").count(), 0);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        const dir = process.env.PENCMI_TRIP_SCREENSHOTS;
        if (dir) {
          await mkdir(dir, { recursive: true });
          await page.screenshot({
            path: join(dir, `trip-publication-${width}.png`),
            fullPage: true,
          });
        }
        await page.locator('[data-trip-step="9"]').click();
        await page.locator("[data-submit-trip]").click();
        await page
          .getByText("Votre trajet est en attente de validation.", {
            exact: true,
          })
          .waitFor();
        assert.equal(listing.publication.schedule.arrivalTime, "01:00");
        assert.equal(listing.pricePerSeat, 3000);
        assert.equal(creates, 1);
        await page.goto(origin + "/dashboard/voyages/trajets/");
        await page
          .getByRole("link", { name: "Modifier", exact: true })
          .waitFor();
        assert.equal(await page.locator("td b").count(), 0);
        await page.getByRole("link", { name: "Modifier", exact: true }).click();
        await page.locator('[data-trip-step="6"]').click();
        assert.equal(
          await page.locator('[data-trip-field="content.title"]').inputValue(),
          "<b>Trajet</b>",
        );
        await page.goto(
          origin +
            "/voyages/?depart=Dakar&arrivee=Thi%C3%A8s&date=2099-01-01&passengers=3&vehicleType=bus&minPrice=2500&maxPrice=4000&timeOfDay=night",
        );
        await page.locator(".trip-card").waitFor();
        assert.equal(filters.passengers, "3");
        assert.equal(filters.minPrice, "2500");
        assert.equal(filters.timeOfDay, "night");
        assert.equal(await page.locator(".trip-card img").count(), 0);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.goto(origin + "/voyages/detail/?id=public-trip");
        await page.locator("[data-open-reservation]").click();
        await page.locator('[name="clientName"]').fill("Client test");
        await page.locator('[name="clientEmail"]').fill("client@example.test");
        failed = true;
        await page.locator('#trip-reservation-form [type="submit"]').click();
        await page
          .locator("#trip-reservation-error")
          .filter({ hasText: "Erreur réseau test" })
          .waitFor();
        assert.equal(
          await page.locator('[name="clientName"]').inputValue(),
          "Client test",
        );
        await page.locator('#trip-reservation-form [type="submit"]').click();
        await page
          .getByText("Votre demande a été reçue.", { exact: false })
          .waitFor();
        await page
          .getByRole("button", { name: "Fermer", exact: true })
          .first()
          .click();
        assert.equal(await page.locator(".trip-detail-card h1 img").count(), 0);
        await page.goto(origin + "/dashboard/voyages/trajets/");
        await page.locator('[data-trip-action="delete"]').click();
        await page
          .getByText("Vous n’avez aucun trajet publié pour le moment.", {
            exact: true,
          })
          .waitFor();
        assert.deepEqual(errors, []);
        await page.close();
      }
      assert.equal(seatRequests, 4);
      bulk = true;
      for (const width of [390, 1280]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        await page.addInitScript(() =>
          localStorage.setItem("pencmi_access_token", "test-token"),
        );
        await page.goto(origin + "/dashboard/voyages/trajets/");
        await page.getByText("Page 1 sur 6", { exact: true }).waitFor();
        for (let i = 0; i < 5; i++)
          await page.locator('[data-trip-page="1"]').click();
        await page
          .getByRole("cell", { name: "Trajet 104", exact: true })
          .waitFor();
        await page.goto(origin + "/dashboard/voyages/reservations/");
        await page
          .getByRole("cell", { name: "Client 104", exact: true })
          .waitFor();
        await page.goto(origin + "/dashboard/voyages/messages/");
        await page.locator("[data-open-trip-conversation]").click();
        assert.equal(await page.locator(".trip-dashboard-card b").count(), 0);
        await page
          .locator("[data-trip-reply] textarea")
          .fill("Réponse envoyée");
        await page.locator('[data-trip-reply] button[type="submit"]').click();
        await page.getByText("Réponse envoyée", { exact: false }).waitFor();
        await page.goto(origin + "/dashboard/voyages/statistiques/");
        await page
          .locator(".kpi-value")
          .filter({ hasText: "105" })
          .first()
          .waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.close();
      }
      assert.equal(replies, 2);
    } finally {
      await browser?.close();
      await new Promise((done) => server.close(done));
    }
  },
);
