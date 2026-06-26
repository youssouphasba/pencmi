import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';

function isPrivateFrontendOrigin(origin = '') {
  try {
    const url = new URL(origin);
    const host = url.hostname;

    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const apiPrefix = config.getOrThrow<string>('API_PREFIX');
  const corsOrigins = config
    .get<string>('CORS_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  app.use(helmet());
  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (corsOrigins.includes(origin) || isPrivateFrontendOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origine CORS non autorisée.'));
    },
    credentials: true,
  });
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'api/hotel-partner/v1/(.*)', method: RequestMethod.ALL }],
  });
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
    .setTitle('Péncmi API')
    .setDescription('API backend Péncmi')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(config.get<number>('PORT') ?? 4000);
}

void bootstrap();
