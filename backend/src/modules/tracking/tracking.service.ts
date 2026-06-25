import { Injectable } from '@nestjs/common';
import { PencmiModule, Prisma, TargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateTrackingEventDto } from './tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTrackingEventDto) {
    return this.prisma.trackingEvent.create({
      data: {
        module: dto.module as PencmiModule,
        eventType: dto.eventType,
        targetType: dto.targetType as TargetType | undefined,
        targetId: dto.targetId,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
