import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';

const READY_TIMEOUT_MS = 3000;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process answers. */
  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'pencmi-api',
      checkedAt: new Date().toISOString(),
    };
  }

  /** Readiness: the database answers too. */
  @Public()
  @Get('ready')
  async getReady() {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('timeout')), READY_TIMEOUT_MS))),
      ]);
    } catch {
      throw new ServiceUnavailableException('Base de données indisponible.');
    } finally {
      clearTimeout(timer);
    }
    return { status: 'ready', database: 'ok', latencyMs: Date.now() - started, checkedAt: new Date().toISOString() };
  }
}
