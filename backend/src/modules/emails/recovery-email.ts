import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotImplementedException } from '@nestjs/common';

export const RECOVERY_TEMPLATE_KEY = 'account.password_reset';
export const RECOVERY_TTL_MS = 30 * 60 * 1000;
export const RECOVERY_COPY = {
  received: 'Si un compte éligible existe, vous recevrez les instructions de réinitialisation.',
  unavailable: 'La récupération du mot de passe n’est pas disponible pour le moment.',
  invalid: 'Ce lien est invalide ou expiré. Demandez un nouveau lien.',
  subject: 'Réinitialisez votre mot de passe Péncmi',
  body: 'Une réinitialisation de votre mot de passe a été demandée.\n\n{{resetUrl}}\n\nCe lien expire dans 30 minutes et ne peut être utilisé qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
};

export function recoveryEnabled(config: ConfigService): boolean {
  try { recoveryConfig(config); return true; } catch { return false; }
}

export function recoveryConfig(config: ConfigService) {
  const enabled = config.get('PASSWORD_RECOVERY_ENABLED');
  const key = config.get<string>('EMAIL_QUEUE_ENCRYPTION_KEY') || '';
  const apiKey = config.get<string>('RESEND_API_KEY') || '';
  const from = config.get<string>('EMAIL_FROM') || '';
  let origin: URL;
  try { origin = new URL(config.get<string>('FRONTEND_URL') || ''); }
  catch { throw new NotImplementedException(RECOVERY_COPY.unavailable); }
  const localTest = config.get('NODE_ENV') !== 'production' && ['localhost', '127.0.0.1'].includes(origin.hostname);
  if (!['true', true].includes(enabled) || !/^[a-f0-9]{64}$/i.test(key) || !apiKey
    || !/^[^\r\n]+@[^\r\n]+$/.test(from) || (origin.protocol !== 'https:' && !localTest)
    || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new NotImplementedException(RECOVERY_COPY.unavailable);
  }
  return { key: Buffer.from(key, 'hex'), apiKey, from, origin: origin.origin };
}

export type RecoveryEnvelope = {
  from: string; to: string; subject: string; text: string; resetId: string;
};

export function sealRecoveryEmail(value: RecoveryEnvelope, key: Buffer, id: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(item => item.toString('base64url')).join('.');
}

export function openRecoveryEmail(value: string, key: Buffer, id: string): RecoveryEnvelope {
  const [iv, tag, data] = value.split('.').map(item => Buffer.from(item, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
}
