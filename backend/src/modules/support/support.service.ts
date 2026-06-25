import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSupportMessageDto, CreateSupportTicketDto } from './support.dto';

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
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createMessage(ticketId: string, userId: string, dto: CreateSupportMessageDto) {
    return this.prisma.supportMessage.create({
      data: { ticketId, senderUserId: userId, body: dto.body },
    });
  }
}
