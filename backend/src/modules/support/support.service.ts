import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';
import { getPagination } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSupportMessageDto, CreateSupportTicketDto, SupportQueueDto } from './support.dto';
import { SUPPORT_WRITABLE_STATUSES } from './support.constants';

const transitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ['pending', 'resolved', 'closed'],
  pending: ['open', 'resolved', 'closed'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  findCategories() {
    return this.prisma.supportCategory.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  createTicket(userId: string, dto: CreateSupportTicketDto) {
    this.assertUserId(userId);
    return this.prisma.supportTicket.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        subject: dto.subject,
        messages: {
          create: {
            senderUserId: userId,
            body: dto.body,
          },
        },
      },
      include: { messages: true },
    });
  }

  findMine(userId: string) {
    this.assertUserId(userId);
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createMessage(ticketId: string, userId: string, dto: CreateSupportMessageDto) {
    this.assertUserId(userId);
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findFirst({
        where: { id: ticketId, userId },
        select: { id: true, status: true },
      });
      if (!ticket) throw new NotFoundException('Ticket indisponible.');
      if (!SUPPORT_WRITABLE_STATUSES.includes(ticket.status)) {
        throw new ConflictException('Ce ticket ne peut plus recevoir de messages.');
      }

      // The conditional update locks the ticket until the message transaction commits.
      const locked = await tx.supportTicket.updateMany({
        where: { id: ticketId, userId, status: { in: SUPPORT_WRITABLE_STATUSES } },
        data: { updatedAt: new Date() },
      });
      if (locked.count !== 1) throw new ConflictException('Ce ticket ne peut plus recevoir de messages.');
      return tx.supportMessage.create({
        data: { ticketId, senderUserId: userId, body: dto.body },
      });
    });
  }

  async queue(query: SupportQueueDto) {
    const where = { status: query.status };
    const page = getPagination(query);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({ where, skip: page.skip, take: page.take,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        select: { id: true, subject: true, status: true, updatedAt: true, userId: true } }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, meta: page.meta(total) };
  }

  async adminDetail(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id }, include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!ticket) throw new NotFoundException('Ticket indisponible.');
    return { ...ticket, actions: transitions[ticket.status], canReply: SUPPORT_WRITABLE_STATUSES.includes(ticket.status) };
  }

  adminReply(ticketId: string, adminId: string, dto: CreateSupportMessageDto) {
    return this.prisma.$transaction(async tx => {
      const locked = await tx.supportTicket.updateMany({
        where: { id: ticketId, status: { in: SUPPORT_WRITABLE_STATUSES } },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new ConflictException('Ce ticket ne peut plus recevoir de messages.');
      const message = await tx.supportMessage.create({ data: { ticketId, senderUserId: adminId, body: dto.body } });
      const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, select: { userId: true } });
      if (ticket.userId && ticket.userId !== adminId) await tx.notification.create({
        data: { userId: ticket.userId, module: 'support', type: 'support_reply', title: 'Réponse du support',
          message: 'Péncmi a répondu à votre demande.', targetUrl: '/contact/#pencmi-account-support' },
      });
      return { id: message.id };
    });
  }

  adminStatus(id: string, adminId: string, status: SupportTicketStatus) {
    return this.prisma.$transaction(async tx => {
      const ticket = await tx.supportTicket.findUnique({ where: { id }, select: { status: true } });
      if (!ticket) throw new NotFoundException('Ticket indisponible.');
      if (ticket.status === status) return { id, status };
      if (!transitions[ticket.status].includes(status)) throw new ConflictException('Ce changement de statut est indisponible.');
      const updated = await tx.supportTicket.updateMany({ where: { id, status: ticket.status }, data: { status } });
      if (!updated.count) throw new ConflictException('Ce ticket a changé. Actualisez la page.');
      await tx.auditLog.create({ data: { actorUserId: adminId, module: 'support', action: 'support.status_changed',
        targetId: id, metadata: { previousStatus: ticket.status, status } } });
      return { id, status };
    });
  }

  private assertUserId(userId: string) {
    if (typeof userId !== 'string' || !userId.trim()) throw new UnauthorizedException('Authentification requise.');
  }
}
