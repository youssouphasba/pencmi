import { BadRequestException, Injectable, NotImplementedException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import { recoveryConfig, sealRecoveryEmail } from '../modules/emails/recovery-email';

export const VERIFICATION_TEMPLATE = 'account.email_verification';
export const VERIFICATION_TTL = 30 * 60 * 1000;
export const VERIFICATION_COPY = {
  subject: 'Vérifiez votre adresse email Péncmi',
  body: 'Confirmez votre adresse email :\n\n{{verificationUrl}}\n\nCe lien expire dans 30 minutes. Si vous n’avez pas demandé cette vérification, ignorez ce message.',
  invalid: 'Ce lien est invalide ou expiré.',
  queued: 'Votre demande de vérification a été enregistrée.',
};

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async capabilities() {
    try { recoveryConfig(this.config, 'EMAIL_VERIFICATION_ENABLED'); }
    catch { return { emailVerification: false }; }
    const template = await this.prisma.emailTemplate.findUnique({ where: { key: VERIFICATION_TEMPLATE } });
    return { emailVerification: !template || (template.active && template.body.includes('{{verificationUrl}}')) };
  }

  async request(userId: string) {
    const config = recoveryConfig(this.config, 'EMAIL_VERIFICATION_ENABLED');
    const template = await this.prisma.emailTemplate.findUnique({ where: { key: VERIFICATION_TEMPLATE } });
    if (template && (!template.active || !template.body.includes('{{verificationUrl}}'))) throw new NotImplementedException('La vérification email est indisponible.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR NO KEY UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt || user.status !== 'active') throw new UnauthorizedException();
      if (!user.email) throw new BadRequestException('Aucune adresse email associée au compte.');
      if (user.emailVerified) return { verified: true };
      const response = { verified: false, message: VERIFICATION_COPY.queued };
      const recent = await tx.emailVerificationToken.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 60000) } } });
      const hourly = await tx.emailVerificationToken.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3600000) } } });
      if (recent || hourly >= 5) return response;
      const token = randomBytes(32).toString('hex');
      const record = await tx.emailVerificationToken.create({ data: {
        userId, email: user.email, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + VERIFICATION_TTL),
      } });
      const id = randomUUID();
      const subject = template?.subject || VERIFICATION_COPY.subject;
      const text = (template?.body || VERIFICATION_COPY.body).replaceAll('{{verificationUrl}}', `${config.origin}/verify-email/#token=${token}`);
      const encrypted = sealRecoveryEmail({ from: config.from, to: user.email, subject, text, resetId: record.id }, config.key, id);
      await tx.emailLog.create({ data: { id, templateKey: VERIFICATION_TEMPLATE, toEmail: user.email, subject,
        payload: { kind: 'email-verification-v1', encrypted, attempts: 0, nextAttemptAt: Date.now() } } });
      return response;
    });
  }

  async confirm(value: string) {
    recoveryConfig(this.config, 'EMAIL_VERIFICATION_ENABLED');
    if (!/^[a-f0-9]{64}$/i.test(value)) throw new BadRequestException(VERIFICATION_COPY.invalid);
    const tokenHash = createHash('sha256').update(value).digest('hex');
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record) throw new BadRequestException(VERIFICATION_COPY.invalid);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${record.userId} FOR NO KEY UPDATE`;
      const user = await tx.user.findUnique({ where: { id: record.userId } });
      if (!user || user.deletedAt || user.status !== 'active' || user.email !== record.email) throw new BadRequestException(VERIFICATION_COPY.invalid);
      const consumed = await tx.emailVerificationToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!consumed.count) throw new BadRequestException(VERIFICATION_COPY.invalid);
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: user.id, module: 'users', action: 'account.email_verified' } });
      return { verified: true };
    });
  }
}
