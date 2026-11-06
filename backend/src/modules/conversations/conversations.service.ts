import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { getPagination } from "../../common/pagination/pagination.dto";
import {
  ConversationListDto,
  ConversationMessagesDto,
  CreateMessageDto,
  OpenConversationDto,
} from "./conversations.dto";
import {
  displayName,
  findMessagingListing,
  isListingModule,
  ListingModule,
  listingTitles,
  ownedListings,
} from "./conversation-listings";

const DEFAULT_MESSAGE_PAGE = 100;
const participantUser = {
  select: {
    firstName: true,
    lastName: true,
    professionalProfile: { select: { businessName: true } },
  },
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string, query: ConversationListDto = {} as ConversationListDto) {
    const pagination = getPagination(query);
    const where: Prisma.ConversationWhereInput = {
      participants: { some: { userId } },
      ...(query.module ? { module: query.module } : {}),
      ...(query.listingId ? { targetType: "listing", targetId: query.listingId } : {}),
    };
    if (query.scope === "owner") {
      // Participation and ownership together: neither one is enough on its own.
      const owned = await ownedListings(this.prisma, query.module as ListingModule, userId, query.q);
      const ids = owned.map((row) => row.id);
      where.targetType = "listing";
      where.targetId = {
        in: query.listingId ? ids.filter((id) => id === query.listingId) : ids,
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        include: {
          participants: { include: { user: participantUser } },
          messages: {
            where: { hiddenAt: null },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    const titles = await listingTitles(this.prisma, rows);
    const data = await Promise.all(
      rows.map(async (row) => {
        const unreadCount = await this.unreadCount(row, userId);
        return this.present(row, userId, titles, { unreadCount });
      }),
    );
    return { data, meta: pagination.meta(total) };
  }

  async findOne(id: string, userId: string, query: ConversationMessagesDto = {}) {
    await this.assertParticipant(id, userId);
    const take = query.limit ?? DEFAULT_MESSAGE_PAGE;
    const row = await this.prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: {
        participants: { include: { user: participantUser } },
        messages: {
          where: { hiddenAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: take + 1,
          ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
        },
      },
    });
    const hasOlderMessages = row.messages.length > take;
    const messages = row.messages.slice(0, take).reverse();
    const titles = await listingTitles(this.prisma, [row]);
    return this.present({ ...row, messages }, userId, titles, {
      hasOlderMessages,
      unreadCount: await this.unreadCount(row, userId),
    });
  }

  async findForListing(userId: string, module: ListingModule, listingId: string) {
    const existing = await this.existingFor(module, listingId, userId);
    return existing ? this.findOne(existing.id, userId) : null;
  }

  /**
   * Opens or finds the conversation of a client on a listing, with its first message.
   * The stable id makes concurrent openings end up on one conversation.
   */
  async open(userId: string, dto: OpenConversationDto) {
    const listing = await findMessagingListing(this.prisma, dto.module, dto.listingId);
    if (!listing || !listing.visible)
      throw new NotFoundException("Annonce introuvable.");
    if (listing.ownerUserId === userId)
      throw new ForbiddenException("Vous ne pouvez pas vous écrire sur votre propre annonce.");
    if (!listing.messagingEnabled)
      throw new ConflictException("La messagerie n’est pas activée pour cette annonce.");
    for (let attempt = 0; ; attempt++) {
      const existing = await this.existingFor(dto.module, dto.listingId, userId, listing.ownerUserId);
      if (existing) {
        const message = await this.createMessage(existing.id, userId, dto);
        return { conversationId: existing.id, created: false, message };
      }
      try {
        return await this.create(userId, dto, listing.ownerUserId);
      } catch (error) {
        // Another request created it first: the next pass finds it.
        if (!isUniqueViolation(error) || attempt > 0) throw error;
      }
    }
  }

  async createMessage(
    conversationId: string,
    senderUserId: string,
    dto: Pick<CreateMessageDto, "body" | "requestId">,
  ) {
    await this.assertParticipant(conversationId, senderUserId);
    const id = dto.requestId
      ? this.messageId(conversationId, senderUserId, dto.requestId)
      : undefined;
    if (id) {
      // A retry must succeed even if the listing closed in the meantime.
      const previous = await this.prisma.message.findUnique({ where: { id } });
      if (previous) return this.sameMessage(previous, dto.body);
    }
    await this.assertCanSend(conversationId, senderUserId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
          data: { ...(id ? { id } : {}), conversationId, senderUserId, body: dto.body },
        });
        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
        return message;
      });
    } catch (error) {
      if (id && isUniqueViolation(error))
        return this.sameMessage(
          await this.prisma.message.findUniqueOrThrow({ where: { id } }),
          dto.body,
        );
      throw error;
    }
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  private conversationId(module: ListingModule, listingId: string, userId: string) {
    return "cnv_" + sha256(`${module}:listing:${listingId}:${userId}`);
  }

  private messageId(conversationId: string, senderUserId: string, requestId: string) {
    return "msg_" + sha256(`${conversationId}:${senderUserId}:${requestId}`);
  }

  private sameMessage<T extends { body: string }>(row: T, body: string) {
    if (row.body !== body)
      throw new ConflictException("Ce message a déjà été envoyé avec un contenu différent.");
    return row;
  }

  /** The stable conversation, or an older one between the same two people. */
  private async existingFor(module: ListingModule, listingId: string, userId: string, ownerUserId?: string) {
    const stable = await this.prisma.conversation.findUnique({
      where: { id: this.conversationId(module, listingId, userId) },
      select: { id: true },
    });
    if (stable) return stable;
    const owner = ownerUserId ?? (await findMessagingListing(this.prisma, module, listingId))?.ownerUserId;
    if (!owner || owner === userId) {
      // The advertiser looking at their own listing has no single conversation to find.
      return null;
    }
    return this.prisma.conversation.findFirst({
      where: {
        module,
        targetType: "listing",
        targetId: listingId,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: owner } } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  }

  private create(userId: string, dto: OpenConversationDto, ownerUserId: string) {
    const conversationId = this.conversationId(dto.module, dto.listingId, userId);
    return this.prisma.$transaction(async (tx) => {
      await tx.conversation.create({
        data: {
          id: conversationId,
          module: dto.module,
          targetType: "listing",
          targetId: dto.listingId,
          participants: { create: [{ userId }, { userId: ownerUserId }] },
        },
      });
      const message = await tx.message.create({
        data: {
          id: this.messageId(conversationId, userId, dto.requestId),
          conversationId,
          senderUserId: userId,
          body: dto.body,
        },
      });
      // One contact per conversation: later messages are not new contacts.
      await tx.contactEvent.create({
        data: {
          module: dto.module,
          source: "internal_message",
          targetType: "listing",
          targetId: dto.listingId,
          ownerUserId,
          clientUserId: userId,
          metadata: { conversationId },
        },
      });
      return { conversationId, created: true, message };
    });
  }

  private unreadCount(
    row: { id: string; participants: { userId: string; lastReadAt: Date | null }[] },
    userId: string,
  ) {
    const lastReadAt = row.participants.find((item) => item.userId === userId)?.lastReadAt;
    return this.prisma.message.count({
      where: {
        conversationId: row.id,
        senderUserId: { not: userId },
        hiddenAt: null,
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  private present<Extra extends object>(
    row: any,
    userId: string,
    titles: Map<string, string>,
    extra: Extra,
  ) {
    const others = row.participants.filter((item: any) => item.userId !== userId);
    return {
      id: row.id,
      module: row.module,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      listingTitle: titles.get(`${row.module}:${row.targetId}`) ?? null,
      counterpartName: displayName(others[0]?.user),
      // No email or phone: identities stop at the display name.
      participants: row.participants.map((item: any) => ({
        userId: item.userId,
        lastReadAt: item.lastReadAt,
      })),
      messages: row.messages.map((message: any) => ({
        id: message.id,
        conversationId: message.conversationId,
        senderUserId: message.senderUserId,
        body: message.body,
        createdAt: message.createdAt,
        mine: message.senderUserId === userId,
      })),
      ...extra,
    };
  }

  /** A client can only write while the listing accepts messages; the advertiser can always answer. */
  private async assertCanSend(conversationId: string, senderUserId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { module: true, targetType: true, targetId: true },
    });
    if (
      conversation.targetType !== "listing" ||
      !conversation.targetId ||
      !isListingModule(conversation.module)
    )
      return;
    const listing = await findMessagingListing(this.prisma, conversation.module, conversation.targetId);
    if (listing?.ownerUserId === senderUserId) return;
    if (!listing?.visible || !listing.messagingEnabled)
      throw new ConflictException("Cette annonce n’accepte plus de messages.");
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException("Accès non autorisé.");
  }
}
