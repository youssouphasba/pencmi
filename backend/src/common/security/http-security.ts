import { ForbiddenException, HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { ErrorRequestHandler } from "express";
import cookieParser = require("cookie-parser");
import helmet from "helmet";
import { parseTrustedProxies } from "./trusted-proxies";

export const HTTP_BODY_LIMIT_BYTES = 100 * 1024;
export const HTTP_FORM_PARAMETER_LIMIT = 1000;
export const HTTP_FORM_DEPTH = 8;

export function isPrivateFrontendOrigin(origin: string) {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return (
      ["http:", "https:"].includes(url.protocol) &&
      (host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        host.endsWith(".local") ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host))
    );
  } catch {
    return false;
  }
}

const parserErrors: Record<string, { status: number; message: string }> = {
  "entity.too.large": {
    status: 413,
    message: "Le corps de la requête est trop volumineux.",
  },
  "parameters.too.many": {
    status: 413,
    message: "Le formulaire contient trop de paramètres.",
  },
  "encoding.unsupported": {
    status: 415,
    message: "Les corps HTTP compressés ne sont pas acceptés.",
  },
  "charset.unsupported": {
    status: 415,
    message: "Encodage de texte non pris en charge.",
  },
  "entity.parse.failed": {
    status: 400,
    message: "Le corps de la requête est invalide.",
  },
  "querystring.parse.rangeError": {
    status: 400,
    message: "Le formulaire est trop imbriqué.",
  },
  "request.aborted": { status: 400, message: "La requête a été interrompue." },
  "request.size.invalid": {
    status: 400,
    message: "La taille de la requête est invalide.",
  },
};

export function configureHttpSecurity(
  app: NestExpressApplication,
  config: ConfigService,
) {
  const server = app.getHttpAdapter().getInstance();
  const proxies = parseTrustedProxies(
    config.get<string>("TRUSTED_PROXY_CIDRS") || "",
  );
  server.set("trust proxy", proxies.length ? proxies : false);
  server.set("query parser", "simple");
  app.use(helmet());
  app.use(cookieParser(config.get<string>("COOKIE_SECRET")));
  const origins = (config.get<string>("CORS_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const production = config.get("NODE_ENV") === "production";
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (
        !origin ||
        origins.includes(origin) ||
        (!production && isPrivateFrontendOrigin(origin))
      )
        callback(null, true);
      else callback(new ForbiddenException("Origine CORS non autorisée."));
    },
    credentials: true,
  });
  const limit =
    config.get<number>("HTTP_BODY_LIMIT_BYTES") ?? HTTP_BODY_LIMIT_BYTES;
  app.useBodyParser("json", { limit, inflate: false });
  app.useBodyParser("urlencoded", {
    limit,
    inflate: false,
    extended: true,
    parameterLimit: HTTP_FORM_PARAMETER_LIMIT,
    depth: HTTP_FORM_DEPTH,
  });
  const parserErrorHandler: ErrorRequestHandler = (
    error,
    _request,
    _response,
    next,
  ) => {
    const mapped = parserErrors[error?.type];
    next(
      mapped && error.status === mapped.status
        ? new HttpException(mapped.message, mapped.status)
        : error,
    );
  };
  app.use(parserErrorHandler);
}
