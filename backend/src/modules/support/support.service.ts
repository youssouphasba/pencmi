import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSupportMessageDto, CreateSupportTicketDto } from './support.dto';
import { SUPPORT_WRITABLE_STATUSES } from './support.constants';

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

  private assertUserId(userId: string) {
    if (typeof userId !== 'string' || !userId.trim()) throw new UnauthorizedException('Authentification requise.');
  }
}
