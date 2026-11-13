import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Requests on one listing queue behind its row lock: leave room for the retries of an
 * impatient client instead of failing after Prisma's default 2 s wait and 5 s run.
 */
export const CLIENT_REQUEST_TRANSACTION = { maxWait: 10_000, timeout: 30_000 };

export function clientRequestId(
  kind: string,
  listingId: string,
  requestId?: string,
) {
  return requestId
    ? 'req_' +
        createHash('sha256')
          .update(`${kind}:${listingId}:${requestId}`)
          .digest('hex')
    : undefined;
}

export function assertSameClientRequest(
  existing: Record<string, unknown>,
  fields: Record<string, unknown>,
) {
  const normalize = (value: unknown) =>
    value instanceof Date ? value.toISOString() : (value ?? null);
  if (
    Object.entries(fields).some(
      ([key, value]) => normalize(existing[key]) !== normalize(value),
    )
  )
    throw new ConflictException(
      'Cette demande a déjà été envoyée avec des informations différentes.',
    );
}
