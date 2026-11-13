import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { request as httpsRequest } from 'https';
import { PrismaService } from '../../database/prisma/prisma.service';
import { HotelIcalError, parsePublicUrl, safeLookup } from './hotel-ical';

/**
 * Webhooks tell a channel manager that a reservation event is waiting. They carry no
 * client data: the partner then reads it from GET /reservations, with its credentials.
 */
export const WEBHOOK_TIMEOUT_MS = 10_000;
/** Delay before each new attempt. After the last one, the notification is abandoned. */
export const WEBHOOK_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 3600_000, 6 * 3600_000, 24 * 3600_000];
const LOCK_MS = 60_000;
const MISSING_KEY_RETRY_MS = 15 * 60_000;
const BATCH = 20;

export type WebhookResponse = { status: number; error?: string };
export type WebhookSender = (url: URL, body: string, headers: Record<string, string>) => Promise<WebhookResponse>;

export function webhookEncryptionKey(): Buffer | null {
  const raw = process.env.HOTEL_WEBHOOK_ENCRYPTION_KEY || '';
  return /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : null;
}

export const newWebhookSecret = () => `whsec_${randomBytes(32).toString('hex')}`;

/** Bound to the partner: a sealed secret copied onto another partner does not open. */
export function sealWebhookSecret(secret: string, key: Buffer, partnerId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(partnerId));
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((item) => item.toString('base64url')).join('.');
}

export function openWebhookSecret(sealed: string, key: Buffer, partnerId: string) {
  const [iv, tag, data] = sealed.split('.').map((item) => Buffer.from(item, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(partnerId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** `v1=` HMAC-SHA256 of "<timestamp>.<body>", hexadecimal. */
export const signWebhook = (secret: string, timestamp: number, body: string) =>
  `v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;

export function parseWebhookUrl(value: unknown): URL {
  try {
    return parsePublicUrl(String(value ?? ''), 'du webhook', true);
  } catch (error) {
    if (error instanceof HotelIcalError) throw new BadRequestException(error.message);
    throw error;
  }
}

/** One POST, no redirect followed. The address is checked when connecting. */
export const postWebhook: WebhookSender = (url, body, headers) =>
  new Promise((resolve) => {
    const request = httpsRequest(
      url,
      {
        method: 'POST',
        lookup: safeLookup as any,
        timeout: WEBHOOK_TIMEOUT_MS,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'user-agent': 'Pencmi-Webhooks/1.0',
          ...headers,
        },
      },
      (response) => {
        response.resume();
        resolve({ status: response.statusCode || 0 });
      },
    );
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'EPENCMITIMEOUT' })));
    request.on('error', (error: any) =>
      resolve({
        status: 0,
        error:
          error?.code === 'EPENCMIBLOCKED'
            ? 'Adresse non publique refusée.'
            : error?.code === 'EPENCMITIMEOUT'
              ? `Pas de réponse en ${WEBHOOK_TIMEOUT_MS / 1000} s.`
              : 'Destinataire injoignable.',
      }),
    );
    request.end(body);
  });

@Injectable()
export class HotelWebhookService {
  private readonly logger = new Logger(HotelWebhookService.name);
  /** Replaced in tests: no network access there. */
  sender: WebhookSender = postWebhook;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sends the notifications that are due. Each one is claimed first, so several servers
   * can run this; a claim left by a crashed server expires after a minute.
   */
  async deliverDue(now = new Date(), limit = BATCH) {
    const claimed = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "HotelChannelWebhookDelivery"
      SET "status" = 'sending', "lockedUntil" = ${new Date(now.valueOf() + LOCK_MS)}
      WHERE "id" IN (
        SELECT "id" FROM "HotelChannelWebhookDelivery"
        WHERE ("status" IN ('pending', 'retrying') AND "nextAttemptAt" <= ${now})
           OR ("status" = 'sending' AND "lockedUntil" < ${now})
        ORDER BY "nextAttemptAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;
    for (const { id } of claimed) {
      try {
        await this.deliver(id);
      } catch {
        this.logger.error('Envoi d’un webhook interrompu. Nouvelle tentative après expiration de sa réservation.');
      }
    }
    return claimed.length;
  }

  private async deliver(id: string) {
    const delivery = await this.prisma.hotelChannelWebhookDelivery.findUnique({
      where: { id },
      include: {
        partner: { select: { id: true, active: true, webhookUrl: true, webhookSecret: true } },
        channelEvent: { select: { requestId: true, ackedAt: true } },
      },
    });
    if (!delivery) return; // Withdrawn with its event meanwhile.
    const close = (data: object) =>
      this.prisma.hotelChannelWebhookDelivery.updateMany({
        where: { id, status: 'sending' },
        data: { lockedUntil: null, ...data },
      });
    const { partner } = delivery;
    if (!partner.active || !partner.webhookUrl || !partner.webhookSecret)
      return close({ status: 'skipped', lastError: 'Webhook retiré ou partenaire désactivé.' });
    // Already read and acknowledged by polling: nothing left to announce.
    if (delivery.channelEvent?.ackedAt) return close({ status: 'skipped', lastError: 'Événement déjà acquitté.' });
    const key = webhookEncryptionKey();
    if (!key)
      return close({
        status: 'retrying',
        nextAttemptAt: new Date(Date.now() + MISSING_KEY_RETRY_MS),
        lastError: 'HOTEL_WEBHOOK_ENCRYPTION_KEY absente du serveur.',
      });
    let url: URL;
    let secret: string;
    try {
      url = parseWebhookUrl(partner.webhookUrl);
      secret = openWebhookSecret(partner.webhookSecret, key, partner.id);
    } catch {
      return close({ status: 'failed', lastError: 'Configuration du webhook illisible : enregistrez-le à nouveau.' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id,
      type: delivery.type,
      createdAt: delivery.createdAt.toISOString(),
      data:
        delivery.type === 'ping'
          ? {}
          : { hotelCode: delivery.hotelCode, eventId: delivery.channelEventId, reservationId: delivery.channelEvent?.requestId ?? null },
    });
    const attempt = delivery.attempts + 1;
    const response = await this.sender(url, body, {
      'x-pencmi-event-id': id,
      'x-pencmi-timestamp': String(timestamp),
      'x-pencmi-signature': signWebhook(secret, timestamp, body),
      'x-pencmi-attempt': String(attempt),
    });
    if (response.status >= 200 && response.status < 300)
      return close({ status: 'sent', attempts: attempt, sentAt: new Date(), lastStatus: response.status, lastError: null });
    const delay = WEBHOOK_RETRY_DELAYS_MS[attempt - 1];
    return close({
      status: delay === undefined ? 'failed' : 'retrying',
      attempts: attempt,
      nextAttemptAt: new Date(Date.now() + (delay ?? 0)),
      lastStatus: response.status || null,
      lastError: response.error ?? `Réponse HTTP ${response.status}.`,
    });
  }
}
