import {
  createOversizedTestPassword,
  createTestPassword,
  createWeakTestPassword,
} from "../../common/testing/test-credentials.fixture";
import {
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { mkdtemp, mkdir, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve, sep } from "path";
import request = require("supertest");
import { AuthService } from "../../auth/auth.service";
import { AuthController } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { ApiResponseInterceptor } from "../../common/interceptors/api-response.interceptor";
import { AllExceptionsFilter } from "../../common/filters/all-exceptions.filter";
import { startAccountFrontend } from "../../common/testing/account-frontend.fixture";
import { PrismaService } from "../../database/prisma/prisma.service";
import { FilesService } from "../../files/files.service";
import { FilesController } from "../../files/files.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { SavedAlertsController } from "../saved-alerts/saved-alerts.controller";
import { SavedAlertsService } from "../saved-alerts/saved-alerts.service";
import { ProfessionalProfilesController } from "../professional-profiles/professional-profiles.controller";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { SupportController } from "../support/support.controller";
import { SupportService } from "../support/support.service";

import type SharpFactory from "sharp";
const sharp: typeof SharpFactory = require("sharp");
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  "Account profile and security on real isolated PostgreSQL",
  () => {
    let db: PrismaClient,
      app: INestApplication,
      module: TestingModule,
      auth: AuthService,
      files: FilesService,
      directory: string;
    const a = `account-a-${randomUUID()}`,
      b = `account-b-${randomUUID()}`;
    let password = createTestPassword();
    const passwordB = createTestPassword();
    let tokens: { accessToken: string; refreshToken: string };
    let tokensB: { accessToken: string; refreshToken: string };
    let png: Buffer;
    const headers = () => ({ Authorization: `Bearer ${tokens.accessToken}` });
    const http = () => request(app.getHttpServer());
    const login = async () => {
      tokens = await auth.login(
        { identifier: `${a}@example.test`, password },
        "Test browser",
      );
      return tokens;
    };

    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !target.pathname.endsWith("_test") ||
        !["127.0.0.1", "localhost"].includes(target.hostname)
      )
        throw new Error("Local isolated PostgreSQL required.");
      db = new PrismaClient({ datasources: { db: { url } } });
      directory = await mkdtemp(join(tmpdir(), "pencmi-account17-"));
      const config = new ConfigService({
        NODE_ENV: "test",
        BACKEND_URL: "",
        STORAGE_DRIVER: "local",
        LOCAL_UPLOAD_DIRECTORY: directory,
        API_PREFIX: "api/v1",
        JWT_SECRET: randomUUID() + randomUUID(),
        REFRESH_TOKEN_SECRET: randomUUID() + randomUUID(),
        JWT_EXPIRES_IN: "15m",
        REFRESH_TOKEN_EXPIRES_IN: "30d",
      });
      await db.user.createMany({
        data: [
          {
            id: a,
            role: "client",
            email: `${a}@example.test`,
            phone: "test-" + randomUUID(),
            passwordHash: await bcrypt.hash(password, 4),
            firstName: "Awa",
            lastName: "Diop",
            city: "Dakar",
            emailVerified: true,
          },
          {
            id: b,
            role: "client",
            email: `${b}@example.test`,
            passwordHash: await bcrypt.hash(passwordB, 4),
            firstName: "Compte privé",
          },
        ],
      });
      module = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot([{ limit: 1000, ttl: 60000 }])],
        controllers: [
          UsersController,
          AuthController,
          FilesController,
          SavedAlertsController,
          ProfessionalProfilesController,
          SupportController,
        ],
        providers: [
          UsersService,
          AuthService,
          FilesService,
          JwtService,
          ThrottlerGuard,
          SavedAlertsService,
          ProfessionalProfilesService,
          SupportService,
          { provide: PrismaService, useValue: db },
          { provide: ConfigService, useValue: config },
        ],
      }).compile();
      auth = module.get(AuthService);
      files = module.get(FilesService);
      app = module.createNestApplication({ logger: false });
      app.setGlobalPrefix("api/v1");
      app.useGlobalGuards(
        new JwtAuthGuard(new Reflector(), auth),
        new PermissionsGuard(new Reflector()),
      );
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());
      app.useGlobalInterceptors(new ApiResponseInterceptor());
      await app.listen(0, "127.0.0.1");
      await login();
      tokensB = await auth.login({
        identifier: `${b}@example.test`,
        password: passwordB,
      });
      png = await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#287c52" },
      })
        .png()
        .withMetadata()
        .toBuffer();
    }, 30000);

    afterAll(async () => {
      await app?.close();
      if (db) {
        await db.supportMessage.deleteMany({
          where: { ticket: { userId: { in: [a, b] } } },
        });
        await db.supportTicket.deleteMany({
          where: { userId: { in: [a, b] } },
        });
        await db.notification.deleteMany({ where: { userId: { in: [a, b] } } });
        await db.savedAlert.deleteMany({ where: { userId: { in: [a, b] } } });
        await db.auditLog.deleteMany({
          where: { actorUserId: { in: [a, b] } },
        });
        await db.fileAsset.deleteMany({
          where: { ownerUserId: { in: [a, b] } },
        });
        await db.user.deleteMany({ where: { id: { in: [a, b] } } });
        await db.$disconnect();
      }
      if (directory && resolve(directory).startsWith(resolve(tmpdir()) + sep))
        await rm(directory, { recursive: true, force: true });
    });

    it("normalizes editable fields, preserves omitted fields and clears only explicitly supplied fields", async () => {
      const result = await http()
        .patch("/api/v1/users/me")
        .set(headers())
        .send({ firstName: "  Awa   Marième  ", city: "  Thiès  " })
        .expect(200);
      expect(result.body.data).toMatchObject({
        id: a,
        firstName: "Awa Marième",
        lastName: "Diop",
        city: "Thiès",
        emailVerified: true,
      });
      await http()
        .patch("/api/v1/users/me")
        .set(headers())
        .send({ firstName: null, city: "" })
        .expect(200);
      expect(
        (await http().get("/api/v1/users/me").set(headers())).body.data,
      ).toMatchObject({ firstName: null, lastName: "Diop", city: null });
      await http()
        .patch("/api/v1/users/me")
        .set(headers())
        .send({ city: 42 })
        .expect(400);
      await http()
        .patch("/api/v1/users/me")
        .set(headers())
        .send({ lastName: "a".repeat(101) })
        .expect(400);
      await login();
      expect(
        (await http().get("/api/v1/users/me").set(headers())).body.data
          .lastName,
      ).toBe("Diop");
    });

    it.each([
      "role",
      "status",
      "userId",
      "id",
      "emailVerified",
      "phoneVerified",
      "avatarUrl",
      "email",
      "phone",
    ])("rejects identity or privilege field %s", async (field) => {
      await http()
        .patch("/api/v1/users/me")
        .set(headers())
        .send({ [field]: field.endsWith("Verified") ? true : b })
        .expect(400);
      expect((await db.user.findUniqueOrThrow({ where: { id: a } })).role).toBe(
        "client",
      );
    });

    it("protects private profiles and never returns password/session security data", async () => {
      await http().get("/api/v1/users/me").expect(401);
      await http().get(`/api/v1/users/${b}`).set(headers()).expect(404);
      const own = (
        await http().get(`/api/v1/users/me?userId=${b}`).set(headers())
      ).body.data;
      expect(own.id).toBe(a);
      expect(JSON.stringify(own)).not.toMatch(
        /passwordHash|tokenHash|refreshToken|userAgent/,
      );
      expect(
        (
          await http()
            .get("/api/v1/users/me")
            .set("Authorization", `Bearer ${tokensB.accessToken}`)
        ).body.data.id,
      ).toBe(b);
    });

    it.each(["jpeg", "png", "webp"] as const)(
      "decodes %s, strips metadata, reencodes to WebP and retires the old avatar",
      async (format) => {
        const original = (await db.user.findUniqueOrThrow({ where: { id: a } }))
          .avatarUrl;
        const buffer = await sharp(png)
          .toFormat(format)
          .withMetadata()
          .toBuffer();
        const result = await http()
          .post("/api/v1/users/me/avatar")
          .set(headers())
          .attach("file", buffer, {
            filename: "untrusted.html",
            contentType: "image/" + format,
          })
          .expect(201);
        const avatarUrl = result.body.data.avatarUrl;
        const response = await http().get(avatarUrl).expect(200);
        expect(response.headers["content-type"]).toContain("image/webp");
        const metadata = await sharp(response.body).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.exif).toBeUndefined();
        if (original) await http().get(original).expect(404);
        expect(
          (await db.user.findUniqueOrThrow({ where: { id: b } })).avatarUrl,
        ).toBeNull();
      },
    );

    it.each([
      [
        "svg",
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      ],
      ["jpeg", Buffer.from([255, 216, 255, 60, 104, 116, 109, 108, 62])],
      ["gif", Buffer.from("GIF89a malformed")],
      ["png", Buffer.from("not an image")],
    ])(
      "rejects unsafe or disguised %s without changing the current avatar",
      async (_format, buffer) => {
        const previous = (await db.user.findUniqueOrThrow({ where: { id: a } }))
          .avatarUrl;
        await http()
          .post("/api/v1/users/me/avatar")
          .set(headers())
          .attach("file", buffer as Buffer, {
            filename: "image.png",
            contentType: "image/png",
          })
          .expect(400);
        expect(
          (await db.user.findUniqueOrThrow({ where: { id: a } })).avatarUrl,
        ).toBe(previous);
      },
    );

    it("bounds multipart bytes and decompressed pixels, and rejects forged multipart fields", async () => {
      await http()
        .post("/api/v1/users/me/avatar")
        .set(headers())
        .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), "big.png")
        .expect(413);
      await http()
        .post("/api/v1/users/me/avatar")
        .set(headers())
        .field("userId", b)
        .attach("file", png, "image.png")
        .expect(400);
      const large = await sharp({
        create: { width: 6000, height: 5000, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      await http()
        .post("/api/v1/users/me/avatar")
        .set(headers())
        .attach("file", large, "large.png")
        .expect(400);
    });

    it("keeps the previous avatar on storage failure and serializes competing replacements", async () => {
      const previous = (await db.user.findUniqueOrThrow({ where: { id: a } }))
        .avatarUrl;
      const count = await db.fileAsset.count({ where: { ownerUserId: a } });
      const spy = jest
        .spyOn(files as any, "persistBinary")
        .mockRejectedValueOnce(
          new ServiceUnavailableException("Stockage indisponible."),
        );
      try {
        await http()
          .post("/api/v1/users/me/avatar")
          .set(headers())
          .attach("file", png, "image.png")
          .expect(503);
      } finally {
        spy.mockRestore();
      }
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: a } })).avatarUrl,
      ).toBe(previous);
      expect(await db.fileAsset.count({ where: { ownerUserId: a } })).toBe(
        count,
      );
      await Promise.all(
        Array.from({ length: 3 }, () =>
          http()
            .post("/api/v1/users/me/avatar")
            .set(headers())
            .attach("file", png, "image.png")
            .expect(201),
        ),
      );
      const final = (await db.user.findUniqueOrThrow({ where: { id: a } }))
        .avatarUrl!;
      await http().get(final).expect(200);
      expect(
        await db.fileAsset.count({
          where: {
            ownerUserId: a,
            deletedAt: null,
            metadata: { path: ["scope"], equals: "avatar" },
          },
        }),
      ).toBe(1);
    });

    it("rolls back a failed account update and cleans the newly stored binary", async () => {
      const previous = (await db.user.findUniqueOrThrow({ where: { id: a } }))
        .avatarUrl;
      const entries = (await readdir(directory, { recursive: true })).length;
      const failed = {
        $transaction: (work: any, options: any) =>
          db.$transaction(
            (tx) =>
              work({
                ...tx,
                user: {
                  ...tx.user,
                  update: async () => {
                    throw new Error("Test update failure");
                  },
                },
              }),
            options,
          ),
      };
      const service = new UsersService(failed as any, files);
      await expect(
        service.uploadAvatar(a, {
          buffer: png,
          size: png.length,
          mimetype: "image/png",
          originalname: "avatar.png",
        }),
      ).rejects.toThrow("Test update failure");
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: a } })).avatarUrl,
      ).toBe(previous);
      expect((await readdir(directory, { recursive: true })).length).toBe(
        entries,
      );
    });

    it("removes only the avatar and never a logo or another account resource", async () => {
      const logo = await files.uploadPublicImage(
        a,
        {
          buffer: png,
          size: png.length,
          mimetype: "image/png",
          originalname: "logo.png",
        },
        "logo",
      );
      await db.user.update({
        where: { id: a },
        data: { avatarUrl: logo.publicUrl },
      });
      await http().delete("/api/v1/users/me/avatar").set(headers()).expect(200);
      expect(
        (await db.fileAsset.findUniqueOrThrow({ where: { id: logo.id } }))
          .deletedAt,
      ).toBeNull();
      await http()
        .delete(`/api/v1/files/${logo.id}`)
        .set("Authorization", `Bearer ${tokensB.accessToken}`)
        .expect(404);
      await http().delete("/api/v1/users/me/avatar").set(headers()).expect(200);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: a } })).avatarUrl,
      ).toBeNull();
    });

    it("keeps the professional-logo upload and removal functional through the shared secure pipeline", async () => {
      const uploaded = await http()
        .post("/api/v1/professional-profiles/me/logo")
        .set(headers())
        .attach("file", png, "logo.png")
        .expect(201);
      const logoUrl = uploaded.body.data.logoUrl;
      expect(logoUrl).toMatch(/^\/api\/v1\/files\/public\//);
      await http().get(logoUrl).expect(200);
      await http()
        .post("/api/v1/professional-profiles/me/logo")
        .set(headers())
        .attach("file", Buffer.from("<svg/>"), "logo.svg")
        .expect(400);
      await http()
        .delete("/api/v1/professional-profiles/me/logo")
        .set(headers())
        .expect(200);
      await http().get(logoUrl).expect(404);
    });

    it("lists only personal sessions and revokes other devices without revoking the current or another account", async () => {
      const other = await auth.login(
        { identifier: `${a}@example.test`, password },
        "<img src=x onerror=alert(1)>",
      );
      const page = (
        await http().get("/api/v1/auth/sessions?limit=100").set(headers())
      ).body;
      expect(
        page.data.filter((row: { current: boolean }) => row.current),
      ).toHaveLength(1);
      expect(JSON.stringify(page)).not.toMatch(
        /tokenHash|passwordHash|refreshToken|ipAddress|userId/,
      );
      const foreign = new JwtService().decode<{ sessionId: string }>(
        tokensB.accessToken,
      ).sessionId;
      await http()
        .delete(`/api/v1/auth/sessions/${foreign}`)
        .set(headers())
        .expect(404);
      await http()
        .delete("/api/v1/auth/sessions/others")
        .set(headers())
        .expect(200);
      await http()
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${other.accessToken}`)
        .expect(401);
      await http()
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: other.refreshToken })
        .expect(401);
      await http().get("/api/v1/users/me").set(headers()).expect(200);
      await http()
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${tokensB.accessToken}`)
        .expect(200);
    });

    it("keeps session and refresh revocation consistent with a competing new login", async () => {
      const currentId = new JwtService().decode<{ sessionId: string }>(
        tokens.accessToken,
      ).sessionId;
      const [newSession] = await Promise.all([
        auth.login({ identifier: `${a}@example.test`, password }),
        auth.revokeOtherSessions(a, currentId),
      ]);
      const id = new JwtService().decode<{ sessionId: string }>(
        newSession.accessToken,
      ).sessionId;
      const session = await db.userSession.findUniqueOrThrow({ where: { id } });
      const live = await db.refreshToken.count({
        where: { sessionId: id, revokedAt: null, consumedAt: null },
      });
      expect(live).toBe(session.revokedAt ? 0 : 1);
      if (session.revokedAt)
        await expect(
          auth.validateAccessToken(newSession.accessToken),
        ).rejects.toMatchObject({ status: 401 });
      else
        await expect(
          auth.validateAccessToken(newSession.accessToken),
        ).resolves.toMatchObject({ id: a });
    });

    it("rejects wrong, weak, reused or oversized credentials without mutation", async () => {
      const hash = (await db.user.findUniqueOrThrow({ where: { id: a } }))
        .passwordHash;
      for (const body of [
        {
          currentPassword: createTestPassword(),
          newPassword: createTestPassword(),
        },
        { currentPassword: password, newPassword: createWeakTestPassword() },
        { currentPassword: password, newPassword: password },
        {
          currentPassword: password,
          newPassword: createOversizedTestPassword(),
        },
        {
          currentPassword: password,
          newPassword: createTestPassword(),
          userId: b,
        },
      ])
        await http()
          .post("/api/v1/auth/change-password")
          .set(headers())
          .send(body)
          .expect(400);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: a } })).passwordHash,
      ).toBe(hash);
      await http().get("/api/v1/users/me").set(headers()).expect(200);
    });

    it("changes the hash, audits without secrets, and invalidates every old access/refresh token", async () => {
      const older = await auth.login({
        identifier: `${a}@example.test`,
        password,
      });
      const next = createTestPassword();
      await http()
        .post("/api/v1/auth/change-password")
        .set(headers())
        .send({ currentPassword: password, newPassword: next })
        .expect(201);
      for (const credentials of [tokens, older]) {
        await http()
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${credentials.accessToken}`)
          .expect(401);
        await http()
          .post("/api/v1/auth/refresh")
          .send({ refreshToken: credentials.refreshToken })
          .expect(401);
      }
      await http()
        .post("/api/v1/auth/login")
        .send({ identifier: `${a}@example.test`, password })
        .expect(401);
      const audit = await db.auditLog.findMany({ where: { actorUserId: a } });
      expect(JSON.stringify(audit)).not.toContain(password);
      expect(JSON.stringify(audit)).not.toContain(next);
      expect(
        audit.some((row) => row.action === "account.password_changed"),
      ).toBe(true);
      password = next;
      await login();
      expect(
        await db.notification.count({
          where: { userId: a, type: "password_changed" },
        }),
      ).toBe(1);
      await http()
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${tokensB.accessToken}`)
        .expect(200);
    });

    it("prevents an in-flight old-password login from surviving a concurrent password change", async () => {
      const next = createTestPassword();
      const [attempt, changed] = await Promise.all([
        http()
          .post("/api/v1/auth/login")
          .send({ identifier: `${a}@example.test`, password }),
        http()
          .post("/api/v1/auth/change-password")
          .set(headers())
          .send({ currentPassword: password, newPassword: next }),
      ]);
      expect(changed.status).toBe(201);
      expect([201, 401]).toContain(attempt.status);
      if (attempt.status === 201)
        await http()
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${attempt.body.data.accessToken}`)
          .expect(401);
      expect(
        await db.userSession.count({ where: { userId: a, revokedAt: null } }),
      ).toBe(0);
      password = next;
      await login();
    });

    it("does not pretend to send recovery emails or reset a password", async () => {
      await http()
        .post("/api/v1/auth/forgot-password")
        .send({ identifier: `${a}@example.test` })
        .expect(501);
      await http()
        .post("/api/v1/auth/reset-password")
        .send({ token: "unused", password: createTestPassword() })
        .expect(501);
    });

    it("allows exactly one simultaneous password change and a real current-session revocation", async () => {
      const candidates = [createTestPassword(), createTestPassword()];
      const responses = await Promise.all(
        candidates.map((newPassword) =>
          http()
            .post("/api/v1/auth/change-password")
            .set(headers())
            .send({ currentPassword: password, newPassword }),
        ),
      );
      expect(
        responses.filter((response) => response.status === 201),
      ).toHaveLength(1);
      expect(
        responses.filter((response) => response.status === 401),
      ).toHaveLength(1);
      password =
        candidates[responses.findIndex((response) => response.status === 201)];
      await login();
      const sessionId = new JwtService().decode<{ sessionId: string }>(
        tokens.accessToken,
      ).sessionId;
      await http()
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set(headers())
        .expect(200);
      await http().get("/api/v1/users/me").set(headers()).expect(401);
      await login();
    });

    (process.env.PENCMI_PLAYWRIGHT_MODULE ? it : it.skip)(
      "real browser: profile, photo, network retry, password change, reconnect and settings at four widths",
      async () => {
        const { chromium } = require(
          process.env.PENCMI_PLAYWRIGHT_MODULE!.replace(
            /index\.mjs$/,
            "index.js",
          ),
        );
        const frontend = await startAccountFrontend(await app.getUrl());
        const browser = await chromium.launch({
          channel: "msedge",
          headless: true,
        });
        const xss = '<img src=x onerror="window.accountXss=1">';
        try {
          for (const width of [360, 390, 768, 1280]) {
            const session = await login();
            const context = await browser.newContext({
              viewport: { width, height: 900 },
            });
            await context.addInitScript(
              ({
                accessToken,
                refreshToken,
              }: {
                accessToken: string;
                refreshToken: string;
              }) => {
                if (!localStorage.getItem("pencmi_access_token")) {
                  localStorage.setItem("pencmi_access_token", accessToken);
                  localStorage.setItem("pencmi_refresh_token", refreshToken);
                }
              },
              session,
            );
            const page = await context.newPage();
            const noOverflow = async () =>
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth + 1,
                ),
              ).toBe(true);
            await page.goto(frontend.origin + "/compte/profil/");
            await page.locator("input[name=firstName]").waitFor();
            expect(
              await page
                .locator(
                  "input[name=email],input[name=phone],input[name=avatarUrl]",
                )
                .count(),
            ).toBe(0);
            await page.locator("input[name=firstName]").fill(xss);
            await page.locator("input[name=city]").fill(`Ville ${width}`);
            if (width === 360)
              for (const status of [403, 409, 422]) {
                await page.route(
                  "**/api/v1/users/me",
                  (route: any) =>
                    route.fulfill({
                      status,
                      contentType: "application/json",
                      body: JSON.stringify({
                        success: false,
                        error: { message: "Modification refusée." },
                      }),
                    }),
                  { times: 1 },
                );
                await page
                  .getByRole("button", {
                    name: "Enregistrer les modifications",
                    exact: true,
                  })
                  .click();
                await page
                  .getByText("Modification refusée.", { exact: true })
                  .waitFor();
                expect(
                  await page.locator("input[name=city]").inputValue(),
                ).toBe(`Ville ${width}`);
              }
            await page.route(
              "**/api/v1/users/me",
              async (route: any) => {
                if (route.request().method() === "PATCH") {
                  await route.fetch();
                  await route.abort();
                } else await route.continue();
              },
              { times: 1 },
            );
            await page
              .getByRole("button", {
                name: "Enregistrer les modifications",
                exact: true,
              })
              .click();
            await page.locator(".ae-feedback [role=alert]").waitFor();
            expect(
              await page.locator("input[name=firstName]").inputValue(),
            ).toBe(xss);
            expect(
              await page
                .getByText("Votre profil a été mis à jour.", { exact: true })
                .count(),
            ).toBe(0);
            await page
              .getByRole("button", {
                name: "Enregistrer les modifications",
                exact: true,
              })
              .click();
            await page
              .getByText("Votre profil a été mis à jour.", { exact: true })
              .waitFor();
            await page.reload();
            await page.waitForFunction(
              (value: string) =>
                (
                  document.querySelector(
                    "input[name=firstName]",
                  ) as HTMLInputElement
                )?.value === value,
              xss,
            );
            expect(
              await page.evaluate(() => (window as any).accountXss),
            ).toBeUndefined();
            await page.locator("input[name=avatarFile]").setInputFiles({
              name: "photo.png",
              mimeType: "image/png",
              buffer: png,
            });
            await page
              .getByRole("button", { name: "Téléverser la photo", exact: true })
              .click();
            await page
              .getByText("Votre photo a été mise à jour.", { exact: true })
              .waitFor();
            await page.reload();
            await page.waitForFunction(
              () =>
                (document.querySelector(".ae-avatar img") as HTMLImageElement)
                  ?.naturalWidth > 0,
            );
            await noOverflow();
            if (width === 360 || width === 1280) {
              const artifacts = resolve(
                process.env.LOCALAPPDATA!,
                "Pencmi",
                "test-artifacts",
                "stage17",
              );
              await mkdir(artifacts, { recursive: true });
              await page.screenshot({
                path: resolve(artifacts, `profile-${width}.png`),
                fullPage: true,
              });
            }
            await page
              .getByRole("button", { name: "Supprimer la photo", exact: true })
              .click();
            await page
              .getByText("Votre photo a été supprimée.", { exact: true })
              .waitFor();
            await page.goto(frontend.origin + "/compte/parametres/");
            await page.getByText("Cet appareil", { exact: true }).waitFor();
            expect(await page.locator("input[type=checkbox]").count()).toBe(0);
            expect(
              await page
                .getByRole("button", {
                  name: /Vérifier email|Vérifier téléphone|Supprimer mon compte/,
                })
                .count(),
            ).toBe(0);
            await noOverflow();
            await page
              .getByRole("link", { name: "Contacter le support", exact: true })
              .click();
            await page.locator("[name=subject]").fill(`Assistance ${width}`);
            await page
              .locator("[name=body]")
              .fill("Question concernant mon compte.");
            await page
              .getByRole("button", { name: "Envoyer la demande", exact: true })
              .click();
            await page
              .getByText("Votre demande de support a été enregistrée.", {
                exact: true,
              })
              .waitFor();
            expect(
              await db.supportTicket.count({
                where: { userId: a, subject: `Assistance ${width}` },
              }),
            ).toBe(1);
            await noOverflow();
            await page.goto(frontend.origin + "/compte/parametres/");
            const alert = await module.get(SavedAlertsService).create(a, {
              module: "hotels",
              name: `Recherche ${width}`,
              filters: { city: `Ville ${width}` },
            });
            await page
              .getByRole("link", { name: "Gérer mes alertes", exact: true })
              .click();
            const card = page.locator(".sv-card", {
              hasText: `Recherche ${width}`,
            });
            await card
              .getByRole("button", { name: "Mettre en pause", exact: true })
              .click();
            await page
              .locator(".sv-card", { hasText: `Recherche ${width}` })
              .getByText("En pause", { exact: true })
              .waitFor();
            expect(
              (
                await db.savedAlert.findUniqueOrThrow({
                  where: { id: alert.id },
                })
              ).active,
            ).toBe(false);
            await page.goto(frontend.origin + "/compte/parametres/");
            const next = createTestPassword();
            await page.locator("[name=currentPassword]").fill(password);
            await page.locator("[name=newPassword]").fill(next);
            await page.locator("[name=confirmation]").fill(next);
            await page
              .getByRole("button", {
                name: "Changer le mot de passe",
                exact: true,
              })
              .click();
            await page
              .getByText(
                "Votre mot de passe a été modifié. Reconnectez-vous.",
                { exact: true },
              )
              .waitFor();
            expect(
              await page.evaluate(() =>
                localStorage.getItem("pencmi_access_token"),
              ),
            ).toBeNull();
            password = next;
            await page
              .getByRole("link", { name: "Se reconnecter", exact: true })
              .click();
            await page
              .locator("[data-login-form] [name=identifier]")
              .fill(`${a}@example.test`);
            await page
              .locator("[data-login-form] [name=password]")
              .fill(password);
            await page.locator("[data-login-form] [type=submit]").click();
            await page.waitForURL("**/compte/parametres/");
            await page.getByText("Cet appareil", { exact: true }).waitFor();
            await page.goto(frontend.origin + "/compte/profil/");
            await page.waitForFunction(
              (value: string) =>
                (document.querySelector("[name=city]") as HTMLInputElement)
                  ?.value === value,
              `Ville ${width}`,
            );
            for (const path of ["/forgot-password/", "/reset-password/"]) {
              await page.goto(frontend.origin + path);
              await page
                .getByRole("link", {
                  name: "Contacter le support",
                  exact: true,
                })
                .waitFor();
              expect(await page.locator("form").count()).toBe(0);
            }
            await context.close();
          }
        } finally {
          await browser.close();
          await frontend.close();
        }
      },
      240000,
    );

    it("enforces the password-change throttle over HTTP", async () => {
      await login();
      const limited = module.createNestApplication({ logger: false });
      limited.setGlobalPrefix("api/v1");
      limited.useGlobalGuards(
        new JwtAuthGuard(new Reflector(), auth),
        module.get(ThrottlerGuard),
      );
      limited.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await limited.init();
      try {
        for (let i = 0; i < 5; i++)
          await request(limited.getHttpServer())
            .post("/api/v1/auth/change-password")
            .set(headers())
            .send({
              currentPassword: createTestPassword(),
              newPassword: createTestPassword(),
            })
            .expect(400);
        await request(limited.getHttpServer())
          .post("/api/v1/auth/change-password")
          .set(headers())
          .send({
            currentPassword: createTestPassword(),
            newPassword: createTestPassword(),
          })
          .expect(429);
      } finally {
        await limited.close();
      }
    });
  },
);
