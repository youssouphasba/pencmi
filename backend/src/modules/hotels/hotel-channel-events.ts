import { Prisma } from '@prisma/client';
import { hotelSyncMode } from './hotel-inventory';

export type HotelChannelEventKind = 'commit' | 'cancel';

/**
 * Queues what the channel manager has to read about a reservation, in the transaction
 * that changes it. A reservation the channel manager never received is not cancelled
 * there: its pending confirmation is simply withdrawn.
 */
export async function queueHotelChannelEvent(
  tx: Prisma.TransactionClient,
  integration: any,
  requestId: string,
  kind: HotelChannelEventKind,
) {
  if (hotelSyncMode(integration) !== 'channel_manager') return;
  if (kind === 'cancel') {
    const commit = await tx.hotelChannelEvent.findUnique({
      where: { requestId_kind: { requestId, kind: 'commit' } },
    });
    if (!commit) return;
    // Conditional, so a reading that marked it delivered meanwhile wins: the cancellation is then queued.
    const withdrawn = await tx.hotelChannelEvent.deleteMany({
      where: { id: commit.id, deliveredAt: null },
    });
    if (withdrawn.count) return;
  }
  const event = await tx.hotelChannelEvent.upsert({
    where: { requestId_kind: { requestId, kind } },
    create: { integrationId: integration.id, requestId, kind },
    update: {},
  });
  // Announced by webhook when the partner registered one: sent by the worker, after commit.
  const partner = integration.channelPartnerId
    ? await tx.hotelChannelPartner.findFirst({
        where: { id: integration.channelPartnerId, active: true, webhookUrl: { not: null } },
        select: { id: true },
      })
    : null;
  if (partner)
    await tx.hotelChannelWebhookDelivery.createMany({
      data: [{ partnerId: partner.id, channelEventId: event.id, type: `reservation.${kind}`, hotelCode: integration.hotelCode ?? null }],
      skipDuplicates: true,
    });
}
