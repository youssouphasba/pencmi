import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { recoveryConfig, sealRecoveryEmail } from './recovery-email';

export const BUSINESS_EMAIL_FLAG = 'BUSINESS_EMAILS_ENABLED';
export const BUSINESS_EMAIL_KIND = 'business-email-v1';
export const BUSINESS_EMAIL_TTL_MS = 12 * 60 * 60 * 1000;
const templates = {
  message: ['Un nouveau message sur Péncmi', 'Vous avez reçu un nouveau message.'],
  request_status: ['Votre demande a été mise à jour', 'Consultez le nouveau statut de votre demande.'],
  listing_decision: ['Une décision concerne votre annonce', 'Consultez la décision dans votre espace annonceur.'],
  verification_decision: ['Votre vérification a été mise à jour', 'Consultez la décision dans votre espace de vérification.'],
} as const;

export async function queueBusinessEmail(tx: Prisma.TransactionClient, type: keyof typeof templates, eventId: string, userId: string, path: string) {
  if (process.env[BUSINESS_EMAIL_FLAG] !== 'true') return;
  let config;
  try { config = recoveryConfig({ get: (key: string) => process.env[key] }, BUSINESS_EMAIL_FLAG); }
  catch { return; }
  const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null, status: 'active', emailVerified: true, businessEmailsEnabled: true }, select: { email: true } });
  if (!user?.email) return;
  const key = `business.${type}`;
  const template = await tx.emailTemplate.findUnique({ where: { key } });
  if (template && (!template.active || !template.body.includes('{{url}}'))) return;
  const [defaultSubject, defaultBody] = templates[type];
  const subject = template?.subject || defaultSubject;
  const url = new URL(path, config.origin);
  if (url.origin !== config.origin) return;
  const body = (template?.body || defaultBody + '\n\n{{url}}').replaceAll('{{url}}', url.href);
  const id = createHash('sha256').update(JSON.stringify([key, eventId, userId])).digest('hex');
  const encrypted = sealRecoveryEmail({ from: config.from, to: user.email, subject, text: body, resetId: userId }, config.key, id);
  await tx.emailLog.createMany({ data: [{ id, templateKey: key, subject, toEmail: user.email,
    payload: { kind: BUSINESS_EMAIL_KIND, encrypted, attempts: 0, nextAttemptAt: Date.now() } }], skipDuplicates: true });
}
