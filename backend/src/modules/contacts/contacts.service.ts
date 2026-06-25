import { Injectable } from '@nestjs/common';
import { PencmiModule } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(ownerUserId: string, module?: string) {
    return this.prisma.contactEvent.findMany({
      where: {
        ownerUserId,
        ...(module ? { module: module as PencmiModule } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
