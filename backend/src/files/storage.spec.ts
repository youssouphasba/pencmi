import { ConfigService } from '@nestjs/config';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type SharpFactory from 'sharp';
import { FilesService } from './files.service';
import { assertUploadStorage, remoteStorageConfig } from './storage.config';
import { publicationDatabase } from '../modules/real-estate/publication.fixture';

const sharp: typeof SharpFactory = require('sharp');
const remote = {
  NODE_ENV: 'production',
  STORAGE_DRIVER: 'r2',
  S3_BUCKET: 'pencmi-storage-test',
  S3_ENDPOINT: 'https://storage-test.r2.cloudflarestorage.com',
  S3_ACCESS_KEY_ID: 'test-access-key-not-a-real-credential',
  S3_SECRET_ACCESS_KEY: 'test-secret-not-a-real-credential',
};

describe('Upload storage configuration', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    {},
    { NODE_ENV: 'development', STORAGE_DRIVER: 'local' },
    { NODE_ENV: 'test' },
  ])('permits local development storage: %j', (values) => {
    expect(() => assertUploadStorage(new ConfigService(values))).not.toThrow();
  });

  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', STORAGE_DRIVER: 'local' },
    { NODE_ENV: 'development', STORAGE_DRIVER: 'typo' },
    { ...remote, S3_SECRET_ACCESS_KEY: '' },
    { ...remote, S3_BUCKET: '' },
    { ...remote, S3_ENDPOINT: '' },
    { ...remote, S3_ENDPOINT: 'http://storage-test.r2.cloudflarestorage.com' },
    {
      ...remote,
      S3_ENDPOINT: 'https://storage-test.r2.cloudflarestorage.com/bucket',
    },
    { ...remote, S3_ENDPOINT: 'https://user:password@example.test' },
    { ...remote, S3_ENDPOINT: 'https://example.test' },
  ])('fails closed for incomplete or unsafe configuration #%#', (values) => {
    expect(() => assertUploadStorage(new ConfigService(values))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('uses auto region for R2 and requires an explicit region for native AWS S3', () => {
    expect(remoteStorageConfig(new ConfigService(remote), 'r2').region).toBe(
      'auto',
    );
    const aws = new ConfigService({
      ...remote,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: '',
      S3_REGION: 'eu-west-3',
    });
    const result = remoteStorageConfig(aws, 's3');
    expect(result.endpoint).toBeUndefined();
    expect(result.region).toBe('eu-west-3');
    expect(() =>
      assertUploadStorage(
        new ConfigService({ ...remote, STORAGE_DRIVER: 's3' }),
      ),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects production uploads before creating a file record or touching disk', async () => {
    const db = publicationDatabase();
    const files = new FilesService(
      db.prisma,
      new ConfigService({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' }),
    );
    await expect(
      files.uploadPublicImage(
        'owner',
        {
          buffer: Buffer.from('test'),
          mimetype: 'image/png',
          originalname: 'test.png',
          size: 4,
        },
        'avatar',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(() => files.createUploadPlaceholder('owner')).toThrow(
      ServiceUnavailableException,
    );
    expect(db.prisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('reads an actual local image after creating a new storage service instance', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pencmi-storage-test-'));
    try {
      const config = new ConfigService({
        NODE_ENV: 'test',
        STORAGE_DRIVER: 'local',
        LOCAL_UPLOAD_DIRECTORY: directory,
      });
      const db = publicationDatabase();
      const first = new FilesService(db.prisma, config);
      const buffer = await sharp({
        create: { width: 4, height: 4, channels: 3, background: '#26a269' },
      })
        .png()
        .toBuffer();
      const photo = await first.prepareListingPhoto({
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'photo.png',
      });
      const asset = await first.storeListingPhoto(
        db.prisma,
        'owner',
        'listing',
        'photo',
        photo,
      );
      const restarted = new FilesService(db.prisma, config);
      const retrieved = await restarted.streamOwnedContent(asset.id, 'owner');
      expect(retrieved.buffer).toEqual(photo.buffer);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('uses the existing R2 adapter across service instances without a local fallback (mocked provider)', async () => {
    const objects = new Map<string, Buffer>();
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation((async (command: any) => {
        if (command instanceof PutObjectCommand) {
          objects.set(
            command.input.Key!,
            Buffer.from(command.input.Body as Buffer),
          );
          return {};
        }
        if (command instanceof GetObjectCommand)
          return {
            Body: {
              transformToByteArray: async () =>
                objects.get(command.input.Key!)!,
            },
          };
        return {};
      }) as any);
    const db = publicationDatabase(),
      config = new ConfigService(remote);
    const first = new FilesService(db.prisma, config);
    const buffer = Buffer.from('adapter-test');
    const asset = await first.storeListingPhoto(
      db.prisma,
      'owner',
      'listing',
      'photo',
      {
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'photo.png',
      },
    );
    const restarted = new FilesService(db.prisma, config);
    expect(
      (await restarted.streamOwnedContent(asset.id, 'owner')).buffer,
    ).toEqual(buffer);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns a clear error without provider credentials when the remote provider refuses an upload', async () => {
    const warnings = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    jest
      .spyOn(S3Client.prototype, 'send')
      .mockRejectedValue(new Error('remote-secret-details') as never);
    const db = publicationDatabase();
    const files = new FilesService(db.prisma, new ConfigService(remote));
    const promise = files.storeListingPhoto(
      db.prisma,
      'owner',
      'listing',
      'photo',
      {
        buffer: Buffer.from('data'),
        size: 4,
        mimetype: 'image/png',
        originalname: 'photo.png',
      },
    );
    await expect(promise).rejects.toThrow(ServiceUnavailableException);
    await expect(promise).rejects.toMatchObject({
      message: expect.not.stringContaining('remote-secret-details'),
    });
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(
      remote.S3_SECRET_ACCESS_KEY,
    );
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(
      'remote-secret-details',
    );
    expect(db.prisma.fileAsset.create).not.toHaveBeenCalled();
  });
});
