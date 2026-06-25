import { Injectable } from '@nestjs/common';
import { PencmiModule, ReportStatus, TargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateReportDto, UpdateReportStatusDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(reporterUserId: string, dto: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        reporterUserId,
        module: dto.module as PencmiModule,
        targetType: dto.targetType as TargetType,
        targetId: dto.targetId,
        reason: dto.reason,
        message: dto.message,
      },
    });
  }

  findMine(reporterUserId: string) {
    return this.prisma.report.findMany({
      where: { reporterUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllAdmin() {
    return this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  updateStatus(id: string, dto: UpdateReportStatusDto) {
    return this.prisma.report.update({
      where: { id },
      data: { status: dto.status as ReportStatus },
    });
  }
}
