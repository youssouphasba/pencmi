import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { getPagination } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { findMessagingListing, isListingModule } from '../conversations/conversation-listings';
import { CreateReportDto, ReportListDto, UpdateReportStatusDto } from './reports.dto';

const publicFields = {
  id: true, module: true, targetId: true, targetType: true, reason: true, priority: true,
  status: true, createdAt: true, updatedAt: true,
} as const;
const transitions: Record<ReportStatus, ReportStatus[]> = {
  new: ['in_progress', 'correction_requested', 'resolved', 'rejected'],
  in_progress: ['correction_requested', 'resolved', 'rejected'],
  correction_requested: ['in_progress', 'resolved', 'rejected'],
  resolved: ['archived', 'in_progress'],
  rejected: ['archived', 'in_progress'],
  archived: [],
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(reporterUserId: string, dto: CreateReportDto) {
    const { module, targetType, targetId, reason, message } = dto;
    const advertiserId = await this.resolveTarget(reporterUserId, dto);
    if (advertiserId === reporterUserId) throw new BadRequestException('Vous ne pouvez pas signaler votre propre contenu.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reporterUserId} FOR NO KEY UPDATE`;
      const previous = await tx.report.findFirst({
        where: { reporterUserId, module, targetType, targetId, status: { in: ['new', 'in_progress', 'correction_requested'] } },
        select: publicFields,
      });
      if (previous) return previous;
      return tx.report.create({
        data: { reporterUserId, advertiserId, module, targetType, targetId, reason, message: message || null },
        select: publicFields,
      });
    });
  }

  private async resolveTarget(userId: string, dto: CreateReportDto) {
    const { module, targetType, targetId } = dto;
    if (targetType === 'listing' && isListingModule(module)) {
      const listing = await findMessagingListing(this.prisma, module, targetId);
      if (listing?.visible) return listing.ownerUserId;
    } else if (module === 'messages' && (targetType === 'message' || targetType === 'conversation')) {
      const participants = { some: { userId } };
      if (targetType === 'message') {
        const message = await this.prisma.message.findFirst({
          where: { id: targetId, hiddenAt: null, senderUserId: { not: userId }, conversation: { participants } },
          select: { senderUserId: true },
        });
        if (message) return message.senderUserId;
      } else {
        const conversation = await this.prisma.conversation.findFirst({
          where: { id: targetId, participants },
          select: { participants: { where: { userId: { not: userId } }, select: { userId: true }, take: 2 } },
        });
        if (conversation?.participants.length === 1) return conversation.participants[0].userId;
      }
    } else if (module === 'users' && targetType === 'advertiser') {
      const advertiser = await this.prisma.user.findFirst({
        where: { id: targetId, status: 'active', deletedAt: null, professionalProfile: { isNot: null } },
        select: { id: true },
      });
      if (advertiser) return advertiser.id;
    } else if (module === 'system' && targetType === 'other' && targetId === 'platform') {
      return null;
    }
    throw new NotFoundException('La cible du signalement est indisponible.');
  }

  async list(scope: 'mine' | 'received' | 'admin', userId: string, query: ReportListDto) {
    const page = getPagination(query);
    const where: Prisma.ReportWhereInput = {
      module: query.module, status: query.status, targetType: query.targetType,
      ...(scope === 'mine' ? { reporterUserId: userId } : scope === 'received' ? { advertiserId: userId } : {}),
    };
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where, skip: page.skip, take: page.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          ...publicFields, reporterUserId: scope === 'admin', advertiserId: scope === 'admin',
          decisions: scope === 'received' ? {
            where: { messageToUser: { not: null } }, select: { messageToUser: true },
            orderBy: { createdAt: 'desc' }, take: 1,
          } : false,
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { data: rows, meta: page.meta(count) };
  }

  async findAdmin(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id }, include: { decisions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!report) throw new NotFoundException('Signalement introuvable.');
    const message = report.targetType === 'message' && report.module === 'messages'
      ? await this.prisma.message.findUnique({ where: { id: report.targetId }, select: { body: true, hiddenAt: true } })
      : null;
    return { ...report, actions: transitions[report.status], reportedMessage: message,
      canHideMessage: Boolean(message && !message.hiddenAt && !['archived', 'rejected'].includes(report.status)) };
  }

  updateStatus(id: string, adminId: string, dto: UpdateReportStatusDto) {
    return this.prisma.$transaction(async tx => {
      const report = await tx.report.findUnique({ where: { id } });
      if (!report) throw new NotFoundException('Signalement introuvable.');
      if (report.status === dto.status) return { id, status: report.status };
      if (!transitions[report.status].includes(dto.status))
        throw new ConflictException('Cette transition de statut est indisponible.');
      if (dto.status === 'correction_requested' && (!report.advertiserId || !dto.messageToAdvertiser))
        throw new BadRequestException('Une correction doit être adressée à l’annonceur avec un message.');
      const result = await tx.report.updateMany({ where: { id, status: report.status }, data: { status: dto.status } });
      if (!result.count) throw new ConflictException('Ce signalement a changé. Actualisez la page.');
      await tx.moderationDecision.create({ data: {
        reportId: id, adminUserId: adminId, targetType: report.targetType, targetId: report.targetId,
        action: dto.status, internalNote: dto.note, messageToUser: dto.status === 'correction_requested' ? dto.messageToAdvertiser : null,
      } });
      await tx.auditLog.create({ data: {
        actorUserId: adminId, module: report.module, targetType: report.targetType, targetId: id,
        action: 'report.status_changed', metadata: { previousStatus: report.status, status: dto.status },
      } });
      return { id, status: dto.status };
    });
  }

  hideMessage(id: string, adminId: string, note: string) {
    return this.prisma.$transaction(async tx => {
      const reports = await tx.$queryRaw<Array<{ status: ReportStatus; targetId: string }>>`
        SELECT status, "targetId" FROM "Report" WHERE id = ${id} AND module = 'messages' AND "targetType" = 'message' FOR UPDATE`;
      const report = reports[0];
      if (!report || ['archived', 'rejected'].includes(report.status))
        throw new NotFoundException('Ce signalement ne permet pas de masquer un message.');
      const result = await tx.message.updateMany({ where: { id: report.targetId, hiddenAt: null }, data: { hiddenAt: new Date() } });
      if (!result.count) throw new ConflictException('Le message est déjà masqué ou indisponible.');
      await tx.moderationDecision.create({ data: {
        reportId: id, adminUserId: adminId, targetType: 'message', targetId: report.targetId,
        action: 'message_hidden', internalNote: note,
      } });
      await tx.auditLog.create({ data: {
        actorUserId: adminId, module: 'messages', targetType: 'message', targetId: report.targetId, action: 'message.hidden',
      } });
      return { id: report.targetId, hidden: true };
    });
  }
}
