import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class EmailsService {
  constructor(private readonly prisma: PrismaService) {}

  findLogs() {
    return this.prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  findTemplates() {
    return this.prisma.emailTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
  }
}
