import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateMessageDto } from './conversations.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    await this.assertParticipant(id, userId);
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { participants: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async createMessage(conversationId: string, senderUserId: string, dto: CreateMessageDto) {
    await this.assertParticipant(conversationId, senderUserId);
    return this.prisma.message.create({
      data: { conversationId, senderUserId, body: dto.body },
    });
  }

  markRead(conversationId: string, userId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Accès non autorisé.');
  }
}
