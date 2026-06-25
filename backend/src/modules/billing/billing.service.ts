import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  findPublicPlans() {
    return this.prisma.billingPlan.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
