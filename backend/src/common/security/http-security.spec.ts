import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { Request } from "express";
import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";
import request = require("supertest");
import { AuthService } from "../../auth/auth.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Public } from "../decorators/public.decorator";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { AllExceptionsFilter } from "../filters/all-exceptions.filter";
import { configureHttpSecurity, HTTP_BODY_LIMIT_BYTES } from "./http-security";
import { parseTrustedProxies } from "./trusted-proxies";

@Controller()
class SecurityProbeController {
  @Public() @Get("probe") probe(@Req() req: Request, @Query() query: unknown) {
    return { ip: req.ip, ips: req.ips, query };
  }
  @Public() @Post("echo") echo(@Body() body: unknown) {
    return body;
  }
  @Public()
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Get("limited")
  limited() {
    return { ok: true };
  }
  @Get("private") private() {
    return { ok: true };
  }
  @RequirePermissions("access_admin") @Get("admin") admin() {
    return { ok: true };
  }
}

describe("Production HTTP security", () => {
  let app: NestExpressApplication;
  async function create(proxies = "", mode = "production") {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [SecurityProbeController],
      providers: [
        ThrottlerGuard,
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              if (!["client", "admin"].includes(token))
                throw new UnauthorizedException();
              return { id: "authenticated", role: token, sessionId: "session" };
            },
          },
        },
      ],
    }).compile();
    const instance = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureHttpSecurity(
      instance,
      new ConfigService({
        NODE_ENV: mode,
        CORS_ORIGINS: "https://frontend.example.test,http://192.168.1.141:3001",
        TRUSTED_PROXY_CIDRS: proxies,
      }),
    );
    instance.useGlobalFilters(new AllExceptionsFilter());
    instance.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    instance.useGlobalGuards(
      module.get(ThrottlerGuard),
      new JwtAuthGuard(new Reflector(), module.get(AuthService)),
      new PermissionsGuard(new Reflector()),
    );
    await instance.init();
    return instance;
  }
  beforeAll(async () => {
    app = await create();
  });
  afterAll(() => app.close());

  it("ignores untrusted X-Forwarded-For and Forwarded headers", async () => {
    const baseline = await request(app.getHttpServer())
      .get("/probe")
      .expect(200);
    const forged = await request(app.getHttpServer())
      .get("/probe")
      .set("X-Forwarded-For", "198.51.100.12, 10.0.0.1")
      .set("Forwarded", "for=198.51.100.12")
      .expect(200);
    expect(forged.body.ip).toBe(baseline.body.ip);
    expect(forged.body.ips).toEqual([]);
  });
  it("uses a client address only when the immediate proxy is explicitly trusted", async () => {
    const trusted = await create("127.0.0.1/32,::1/128");
    try {
      const result = await request(trusted.getHttpServer())
        .get("/probe")
        .set("X-Forwarded-For", "203.0.113.3, 198.51.100.12")
        .expect(200);
      expect(result.body.ip).toBe("198.51.100.12");
      expect(result.body.ips).toEqual(["198.51.100.12"]);
    } finally {
      await trusted.close();
    }
  });
  it.each([
    "true",
    "1",
    "*",
    "0.0.0.0/0",
    "::/0",
    "::ffff:10.0.0.0/8",
    "10.0.0.1/99",
    "127.0.0.1,",
    "hostname.test",
  ])("fails closed on invalid or unlimited proxy configuration %s", (value) => {
    expect(() => parseTrustedProxies(value)).toThrow();
  });
  it("accepts explicit IPv4, IPv6 and correctly sized mapped IPv6 CIDRs", () => {
    expect(
      parseTrustedProxies("10.0.0.0/8,::ffff:10.0.0.0/104,2001:db8::/32"),
    ).toHaveLength(3);
  });
  it("keeps the simple query parser without nested object coercion", async () => {
    const result = await request(app.getHttpServer())
      .get("/probe?q[a]=value")
      .expect(200);
    expect(result.body.query).toEqual({ "q[a]": "value" });
  });
  it("accepts a normal JSON body and rejects an excessive body with a safe 413", async () => {
    await request(app.getHttpServer())
      .post("/echo")
      .send({ message: "Bonjour" })
      .expect(201, { message: "Bonjour" });
    const result = await request(app.getHttpServer())
      .post("/echo")
      .send({ message: "x".repeat(HTTP_BODY_LIMIT_BYTES) })
      .expect(413);
    expect(result.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(result.body.error.details).toBeUndefined();
  });
  it.each([
    ["gzip", gzipSync],
    ["deflate", deflateSync],
    ["br", brotliCompressSync],
  ] as const)("rejects %s before decompression", async (encoding, compress) => {
    const body = compress(
      Buffer.from(
        JSON.stringify({ message: "x".repeat(HTTP_BODY_LIMIT_BYTES * 2) }),
      ),
    );
    const result = await request(app.getHttpServer())
      .post("/echo")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", encoding)
      .send(body)
      .expect(415);
    expect(result.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });
  it("rejects malformed JSON without reflecting the submitted content", async () => {
    const result = await request(app.getHttpServer())
      .post("/echo")
      .type("json")
      .send('{"private-marker":')
      .expect(400);
    expect(JSON.stringify(result.body)).not.toContain("private-marker");
  });
  it("bounds form parameters and nesting while preserving normal forms", async () => {
    const valid = await request(app.getHttpServer())
      .post("/echo")
      .type("form")
      .send("profile[city]=Dakar")
      .expect(201);
    expect(valid.body).toEqual({ profile: { city: "Dakar" } });
    await request(app.getHttpServer())
      .post("/echo")
      .type("form")
      .send(Array.from({ length: 1001 }, (_, i) => `a${i}=x`).join("&"))
      .expect(413);
    await request(app.getHttpServer())
      .post("/echo")
      .type("form")
      .send("a[b][c][d][e][f][g][h][i][j]=x")
      .expect(400);
  });
  it("retains Helmet and exact CORS allowlists in production", async () => {
    const allowed = await request(app.getHttpServer())
      .get("/probe")
      .set("Origin", "https://frontend.example.test")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://frontend.example.test",
    );
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["x-frame-options"]).toBeDefined();
    await request(app.getHttpServer())
      .get("/probe")
      .set("Origin", "http://192.168.1.141:3001")
      .expect(200);
    await request(app.getHttpServer())
      .get("/probe")
      .set("Origin", "https://untrusted.example.test")
      .expect(403);
    await request(app.getHttpServer())
      .get("/probe")
      .set("Origin", "http://192.168.1.99:3001")
      .expect(403);
  });
  it("permits private frontend development origins only outside production", async () => {
    const dev = await create("", "development");
    try {
      await request(dev.getHttpServer())
        .get("/probe")
        .set("Origin", "http://192.168.1.99:3001")
        .expect(200);
    } finally {
      await dev.close();
    }
  });
  it("keeps JWT guards and role permissions effective", async () => {
    await request(app.getHttpServer()).get("/private").expect(401);
    await request(app.getHttpServer())
      .get("/private")
      .set("Authorization", "Bearer client")
      .expect(200);
    await request(app.getHttpServer())
      .get("/admin")
      .set("Authorization", "Bearer client")
      .expect(403);
    await request(app.getHttpServer())
      .get("/admin")
      .set("Authorization", "Bearer admin")
      .expect(200);
  });
  it("does not let forged forwarded addresses bypass rate limiting", async () => {
    for (let i = 0; i < 3; i++)
      await request(app.getHttpServer())
        .get("/limited")
        .set("X-Forwarded-For", `198.51.100.${i + 1}`)
        .expect(i < 2 ? 200 : 429);
  });
});
