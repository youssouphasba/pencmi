import { Injectable } from '@nestjs/common';
import { PencmiModule } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async findDashboardStats(ownerUserId: string, module?: string) {
    const moduleFilter = module ? { module: module as PencmiModule } : {};
    const [trackingEvents, contacts, notifications] = await Promise.all([
      this.prisma.trackingEvent.count({ where: moduleFilter }),
      this.prisma.contactEvent.count({ where: { ownerUserId, ...moduleFilter } }),
      this.prisma.notification.count({ where: { userId: ownerUserId } }),
    ]);
    return { trackingEvents, contacts, notifications };
  }
}
