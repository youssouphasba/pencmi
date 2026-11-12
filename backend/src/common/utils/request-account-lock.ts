import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function lockRequestAccounts(tx: Prisma.TransactionClient, ownerId: string, clientId?: string | null) {
  const ids = [...new Set(clientId ? [ownerId, clientId] : [ownerId])];
  // Request flows already lock the listing; do not wait behind a closing owner.
  const accounts = await tx.$queryRaw<Array<{ status: string; deletedAt: Date | null }>>`
    SELECT status, "deletedAt" FROM "User" WHERE id IN (${Prisma.join(ids)})
    ORDER BY id FOR SHARE NOWAIT`.catch(error => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010' && error.meta?.code === '55P03')
      throw new ConflictException('Le compte associé est en cours de modification. Réessayez.');
    throw error;
  });
  if (accounts.length !== ids.length || accounts.some(account => account.status === 'deleted' || account.deletedAt))
    throw new ConflictException('Un compte associé à cette demande est fermé.');
}
