import { Prisma, RequestStatus } from '@prisma/client';
import { createHash } from 'crypto';
import {
  CLIENT_REQUEST_DESTINATIONS,
  ClientRequestType,
} from '../constants/client-requests';
const statusLabels: Partial<Record<RequestStatus, string>> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  cancelled: 'Annulée',
  expired: 'Expirée',
  completed: 'Terminée',
  requires_more_info: 'Informations demandées',
};

export async function notifyClientRequestStatus(
  tx: Prisma.TransactionClient,
  type: ClientRequestType,
  request: {
    id: string;
    clientUserId: string | null;
    status: RequestStatus;
    updatedAt: Date;
  },
  status: RequestStatus,
) {
  if (!request.clientUserId || request.status === status) return;
  const user = await tx.user.findUnique({
    where: { id: request.clientUserId },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return;
  const { module, page } = CLIENT_REQUEST_DESTINATIONS[type];
  const id =
    'ntf_' +
    createHash('sha256')
      .update(
        `request:${type}:${request.id}:${request.status}:${request.updatedAt.toISOString()}:${status}`,
      )
      .digest('hex');
  await tx.notification.createMany({
    data: [
      {
        id,
        userId: user.id,
        module,
        type: 'request_status_changed',
        title: 'Mise à jour de votre demande',
        message: statusLabels[status] || status,
        targetUrl: `/compte/${page}/?id=${encodeURIComponent(request.id)}`,
      },
    ],
    skipDuplicates: true,
  });
}
