import { ConsoleLogger, ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ApiResponseInterceptor } from "./common/interceptors/api-response.interceptor";
import { configureHttpSecurity } from "./common/security/http-security";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const json =
    (config.get<string>("LOG_FORMAT") ??
      (config.get<string>("NODE_ENV") === "production" ? "json" : "text")) ===
    "json";
  app.useLogger(new ConsoleLogger({ json, colors: !json }));
  const apiPrefix = config.getOrThrow<string>("API_PREFIX");
  configureHttpSecurity(app, config);
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Péncmi API")
    .setDescription("API backend Péncmi")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(config.get<number>("PORT") ?? 4000);
}

void bootstrap();
