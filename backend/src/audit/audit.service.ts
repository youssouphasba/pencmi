import { Injectable } from '@nestjs/common';
import { PencmiModule, Prisma, TargetType } from '@prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';

type AuditInput = {
  actorUserId?: string;
  action: string;
  module: PencmiModule;
  targetType?: TargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  write(input: AuditInput) {
    return this.prisma.auditLog.create({ data: input as Prisma.AuditLogUncheckedCreateInput });
  }
}
