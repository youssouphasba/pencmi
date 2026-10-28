import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type StorageDriver = 'local' | 's3' | 'r2';

function unavailable(message: string): never {
  throw new ServiceUnavailableException(message);
}

export function storageDriver(config: ConfigService): StorageDriver {
  const driver = config.get<string>('STORAGE_DRIVER')?.trim() || 'local';
  if (!['local', 's3', 'r2'].includes(driver)) {
    return unavailable('STORAGE_DRIVER invalide. Configurez local, s3 ou r2.');
  }
  return driver as StorageDriver;
}

export function remoteStorageConfig(
  config: ConfigService,
  driver: 's3' | 'r2',
) {
  const value = (key: string) => config.get<string>(key)?.trim() || '';
  const bucket = value('S3_BUCKET');
  const accessKeyId = value('S3_ACCESS_KEY_ID');
  const secretAccessKey = value('S3_SECRET_ACCESS_KEY');
  const endpoint = value('S3_ENDPOINT');
  const region =
    driver === 'r2' ? 'auto' : value('S3_REGION') || value('AWS_REGION');
  if (
    !bucket ||
    /[\s\\/?#]/.test(bucket) ||
    !accessKeyId ||
    !secretAccessKey ||
    !region ||
    (driver === 'r2' && !endpoint)
  ) {
    return unavailable(
      'Stockage persistant incomplet. Vérifiez les variables S3/R2 du service.',
    );
  }
  if (endpoint) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return unavailable(
        'S3_ENDPOINT invalide. Une URL du service de stockage est attendue.',
      );
    }
    const production = config.get<string>('NODE_ENV') === 'production';
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (production && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      return unavailable(
        'S3_ENDPOINT doit être une URL du service, sans identifiants ni chemin de bucket, en HTTPS en production.',
      );
    }
    if (
      driver === 'r2' &&
      (!url.hostname.endsWith('.r2.cloudflarestorage.com') ||
        url.protocol !== 'https:')
    ) {
      return unavailable(
        'S3_ENDPOINT doit être le point d’accès HTTPS compatible S3 de Cloudflare R2.',
      );
    }
  }
  return {
    bucket,
    region,
    endpoint: endpoint || undefined,
    credentials: { accessKeyId, secretAccessKey },
  };
}

export function assertUploadStorage(config: ConfigService) {
  const driver = storageDriver(config);
  if (driver === 'local') {
    if (config.get<string>('NODE_ENV') === 'production') {
      unavailable(
        'Téléversement refusé : configurez un stockage persistant S3 ou R2 en production. Le stockage local est réservé au développement.',
      );
    }
    return;
  }
  remoteStorageConfig(config, driver);
}
