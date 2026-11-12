import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './database/prisma/prisma.module';
import { EmailsService } from './modules/emails/emails.service';
import { recoveryConfig } from './modules/emails/recovery-email';
import { envSchema } from './config/env.schema';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: env => envSchema.parse(env) }), PrismaModule],
  providers: [EmailsService],
})
class EmailWorkerModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(EmailWorkerModule, { logger: false });
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const config = app.get(ConfigService);
    const recovery = ['true', true].includes(config.get('PASSWORD_RECOVERY_ENABLED') ?? false);
    const verification = ['true', true].includes(config.get('EMAIL_VERIFICATION_ENABLED') ?? false);
    const business = config.get('BUSINESS_EMAILS_ENABLED') === 'true';
    if (!recovery && !verification && !business) throw new Error('Email delivery disabled');
    if (recovery) recoveryConfig(config);
    if (verification) recoveryConfig(config, 'EMAIL_VERIFICATION_ENABLED');
    if (business) recoveryConfig(config, 'BUSINESS_EMAILS_ENABLED');
    const service = app.get(EmailsService);
    while (!stopped) {
      try {
        const recovered = recovery && await service.processNextRecoveryEmail();
        const verified = verification && await service.processNextVerificationEmail();
        const notified = business && await service.processNextBusinessEmail();
        if (recovered || verified || notified) continue;
      } catch { console.error('Traitement email indisponible ; nouvelle tentative différée.'); }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } finally { await app.close(); }
}

void run().catch(() => { console.error('Le worker email ne peut pas démarrer. Vérifiez sa configuration.'); process.exitCode = 1; });
