import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { openRecoveryEmail, recoveryConfig, RECOVERY_TEMPLATE_KEY, RECOVERY_TTL_MS } from './recovery-email';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  findLogs() {
    return this.prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, templateKey: true, toEmail: true, subject: true, status: true, error: true, createdAt: true, sentAt: true } });
  }

  findTemplates() {
    return this.prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async processNextRecoveryEmail(send: typeof fetch = fetch): Promise<boolean> {
    const config = recoveryConfig(this.config);
    return this.prisma.$transaction(async tx => {
      // The lock prevents two workers from sending the same queue item concurrently.
      const ids = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "EmailLog" WHERE status = 'pending'
        AND "templateKey" = ${RECOVERY_TEMPLATE_KEY}
        AND payload->>'kind' = 'password-reset-v1'
        AND COALESCE((payload->>'nextAttemptAt')::numeric, 0) <= ${Date.now()}
        ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!ids.length) return false;
      const item = await tx.emailLog.findUniqueOrThrow({ where: { id: ids[0].id } });
      const payload = item.payload as { encrypted: string; attempts: number };
      const terminal = (status: 'failed' | 'cancelled', error: string) => tx.emailLog.update({
        where: { id: item.id }, data: { status, error, payload: Prisma.DbNull },
      });
      if (Date.now() - item.createdAt.getTime() >= RECOVERY_TTL_MS) {
        await terminal('cancelled', 'Lien expiré avant livraison.'); return true;
      }
      let envelope;
      try { envelope = openRecoveryEmail(payload.encrypted, config.key, item.id); }
      catch { await terminal('failed', 'Message chiffré illisible.'); return true; }
      const token = await tx.passwordResetToken.findUnique({ where: { id: envelope.resetId } });
      const user = token && await tx.user.findUnique({ where: { id: token.userId } });
      if (!token || token.usedAt || token.expiresAt <= new Date() || !user || user.status !== 'active' || user.deletedAt || user.email !== envelope.to) {
        await terminal('cancelled', 'Demande devenue inactive.'); return true;
      }
      const attempts = (Number.isInteger(payload.attempts) ? payload.attempts : 0) + 1;
      let permanent = false;
      try {
        const response = await send('https://api.resend.com/emails', {
          method: 'POST', signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `pencmi-recovery/${item.id}` },
          body: JSON.stringify({ from: envelope.from, to: [envelope.to], subject: envelope.subject, text: envelope.text }),
        });
        if (response.ok) {
          const data = await response.json() as { id?: string };
          if (typeof data.id !== 'string' || !data.id) throw new Error('Invalid provider response');
          await tx.emailLog.update({ where: { id: item.id }, data: { status: 'sent', sentAt: new Date(), error: null, payload: Prisma.DbNull } });
          return true;
        }
        permanent = response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status);
        await response.body?.cancel();
      } catch { /* Preserve the same idempotency key when the delivery outcome is uncertain. */ }
      if (permanent || attempts >= 5) await terminal('failed', 'Échec de livraison. Vérifiez la configuration du fournisseur.');
      else await tx.emailLog.update({ where: { id: item.id }, data: {
        error: 'Nouvelle tentative planifiée.',
        payload: { kind: 'password-reset-v1', encrypted: payload.encrypted, attempts, nextAttemptAt: Date.now() + Math.min(300000, 15000 * 2 ** attempts) },
      } });
      return true;
    }, { timeout: 20000, maxWait: 5000 });
  }
}
