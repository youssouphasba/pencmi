import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getPagination } from '../../common/pagination/pagination.dto';
import { UserRole } from '../../common/constants/roles';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService, UploadedImage } from '../../files/files.service';
import { queueBusinessEmail } from '../emails/business-email';
import {
  MAX_VERIFICATION_DOCUMENTS,
  REQUIRED_VERIFICATION_DOCUMENTS,
  VERIFICATION_DOCUMENT_LABELS,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_REQUEST_TYPE,
  VerificationDocumentType,
} from './verification.constants';
import { AdminVerificationQuery, VerificationDecisionDto, VerificationRevokeDto } from './verification.dto';

export type VerificationUpload = UploadedImage & { fieldname: string };

const OWNER_PAGE = '/dashboard/verification/';
const OPEN_STATUSES = ['pending'] as const;

const decisionCopy = {
  accepted: {
    type: 'verification_accepted',
    title: 'Profil vérifié',
    message: 'Vos documents ont été validés : le badge « Professionnel vérifié » apparaît sur vos annonces.',
  },
  refused: {
    type: 'verification_refused',
    title: 'Vérification refusée',
    message: 'Votre demande de vérification a été refusée.',
  },
  requires_more_info: {
    type: 'verification_more_info',
    title: 'Vérification : correction demandée',
    message: 'Votre demande de vérification doit être complétée. Envoyez de nouveau vos documents.',
  },
} as const;

const documentView = (document: { id: string; documentType: string; createdAt: Date }) => ({
  id: document.id,
  documentType: document.documentType,
  label: VERIFICATION_DOCUMENT_LABELS[document.documentType as VerificationDocumentType] ?? document.documentType,
  createdAt: document.createdAt,
});

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  requiredDocuments(role: UserRole) {
    return REQUIRED_VERIFICATION_DOCUMENTS[role] ?? null;
  }

  async mine(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, professionalVerified: true },
    });
    const required = this.requiredDocuments(user.role as UserRole);
    const latest = await this.prisma.verificationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      eligible: Boolean(required),
      verified: user.professionalVerified,
      requiredDocuments: required ?? [],
      documentTypes: VERIFICATION_DOCUMENT_TYPES.map((type) => ({ type, label: VERIFICATION_DOCUMENT_LABELS[type] })),
      maxDocuments: MAX_VERIFICATION_DOCUMENTS,
      latest: latest && {
        id: latest.id,
        status: latest.status,
        reason: latest.reason,
        createdAt: latest.createdAt,
        reviewedAt: latest.reviewedAt,
        documents: latest.documents.map(documentView),
      },
    };
  }

  async submit(userId: string, uploads: VerificationUpload[]) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, professionalVerified: true },
    });
    const required = this.requiredDocuments(user.role as UserRole);
    if (!required) throw new ForbiddenException('La vérification concerne les comptes professionnels.');
    if (user.professionalVerified) throw new ConflictException('Votre profil est déjà vérifié.');
    if (!uploads.length) throw new BadRequestException('Ajoutez vos documents.');
    if (uploads.length > MAX_VERIFICATION_DOCUMENTS)
      throw new BadRequestException(`${MAX_VERIFICATION_DOCUMENTS} documents au maximum.`);
    const types = uploads.map((upload) => upload.fieldname);
    if (types.some((type) => !(VERIFICATION_DOCUMENT_TYPES as readonly string[]).includes(type)))
      throw new BadRequestException('Type de document inconnu.');
    if (types.some((type, index) => type !== 'other' && types.indexOf(type) !== index))
      throw new BadRequestException('Un seul fichier par type de document.');
    const missing = required.filter((type) => !types.includes(type));
    if (missing.length)
      throw new BadRequestException(
        `Documents manquants : ${missing.map((type) => VERIFICATION_DOCUMENT_LABELS[type]).join(', ')}.`,
      );
    // Validates every file before storing any of them.
    const prepared: { type: string; file: UploadedImage }[] = [];
    for (const upload of uploads)
      prepared.push({ type: upload.fieldname, file: await this.files.prepareVerificationDocument(upload) });

    const requestId = randomUUID();
    const stored: string[] = [];
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Serializes the submissions of one account: a single request is reviewed at a time.
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
          const open = await tx.verificationRequest.findFirst({
            where: { userId, status: { in: [...OPEN_STATUSES] } },
            select: { id: true },
          });
          if (open) throw new ConflictException('Une demande est déjà en cours d’examen.');
          await tx.verificationRequest.create({
            data: { id: requestId, userId, type: VERIFICATION_REQUEST_TYPE, status: 'pending' },
          });
          for (const { type, file } of prepared) {
            const fileId = randomUUID();
            await this.files.storeVerificationDocument(tx, userId, requestId, fileId, file);
            stored.push(fileId);
            await tx.verificationDocument.create({
              data: { verificationRequestId: requestId, fileId, documentType: type },
            });
          }
          await tx.auditLog.create({
            data: {
              actorUserId: userId,
              module: 'users',
              targetType: 'document',
              targetId: requestId,
              action: 'verification.submitted',
              metadata: { documents: types },
            },
          });
          return { id: requestId, status: 'pending' as const };
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (error) {
      // The rows are rolled back; remove the binaries already written.
      if (stored.length) await this.files.purgeVerificationDocuments(stored);
      throw error;
    }
  }

  async adminList(query: AdminVerificationQuery) {
    const pagination = getPagination({ page: query.page ?? 1, limit: query.limit ?? 20 });
    const where: Prisma.VerificationRequestWhereInput = { status: query.status ?? 'pending' };
    const [rows, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where,
        orderBy: [{ createdAt: query.status && query.status !== 'pending' ? 'desc' : 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
        include: {
          user: {
            select: {
              id: true,
              role: true,
              firstName: true,
              lastName: true,
              email: true,
              professionalProfile: { select: { businessName: true, city: true } },
            },
          },
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);
    return {
      data: rows.map(({ _count, ...row }) => ({ ...row, documentCount: _count.documents })),
      meta: pagination.meta(total),
    };
  }

  async adminDetail(id: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            status: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            emailVerified: true,
            professionalVerified: true,
            createdAt: true,
            professionalProfile: {
              select: { businessName: true, professionalType: true, city: true, address: true, professionalPhone: true, website: true },
            },
          },
        },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    const available = new Set(
      (
        await this.prisma.fileAsset.findMany({
          where: { id: { in: request.documents.map((document) => document.fileId) }, deletedAt: null },
          select: { id: true },
        })
      ).map((file) => file.id),
    );
    return {
      ...request,
      documents: request.documents.map((document) => ({ ...documentView(document), available: available.has(document.fileId) })),
    };
  }

  async adminDocument(adminId: string, id: string, documentId: string) {
    const document = await this.prisma.verificationDocument.findFirst({
      where: { id: documentId, verificationRequestId: id },
    });
    if (!document) throw new NotFoundException('Document introuvable.');
    const content = await this.files.readVerificationDocument(document.fileId);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        module: 'users',
        targetType: 'document',
        targetId: id,
        action: 'verification.document_viewed',
        metadata: { documentId, documentType: document.documentType },
      },
    });
    return { ...content, documentType: document.documentType };
  }

  async decide(adminId: string, id: string, dto: VerificationDecisionDto) {
    const reason = dto.reason?.trim() || null;
    if (dto.decision !== 'accepted' && !reason) throw new BadRequestException('Indiquez le motif au professionnel.');
    const result = await this.prisma.$transaction(async (tx) => {
      // The conditional update is the lock: two admins cannot decide the same request.
      const changed = await tx.verificationRequest.updateMany({
        where: { id, status: 'pending' },
        data: { status: dto.decision, reason, reviewedByUserId: adminId, reviewedAt: new Date() },
      });
      if (!changed.count) {
        const exists = await tx.verificationRequest.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException('Demande introuvable.');
        throw new ConflictException('Cette demande a déjà été traitée. Actualisez la liste.');
      }
      const request = await tx.verificationRequest.findUniqueOrThrow({
        where: { id },
        include: { documents: { select: { fileId: true } }, user: { select: { id: true, status: true, deletedAt: true } } },
      });
      if (dto.decision === 'accepted') {
        if (request.user.deletedAt || request.user.status !== 'active')
          throw new ConflictException('Ce compte n’est pas actif : il ne peut pas être vérifié.');
        await tx.user.update({ where: { id: request.userId }, data: { professionalVerified: true } });
        await tx.professionalProfile.updateMany({ where: { userId: request.userId }, data: { verified: true } });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          module: 'users',
          targetType: 'document',
          targetId: id,
          action: `verification.${dto.decision}`,
          metadata: { userId: request.userId, reason },
        },
      });
      const copy = decisionCopy[dto.decision];
      const notification = await tx.notification.create({
        data: {
          userId: request.userId,
          module: 'users',
          type: copy.type,
          title: copy.title,
          message: reason ? `${copy.message} Motif : ${reason}` : copy.message,
          targetUrl: OWNER_PAGE,
          metadata: { verificationRequestId: id, status: dto.decision },
        },
      });
      await queueBusinessEmail(tx, 'verification_decision', notification.id, request.userId, OWNER_PAGE);
      return { userId: request.userId, fileIds: request.documents.map((document) => document.fileId) };
    });
    const purgeFailed = await this.files.purgeVerificationDocuments(result.fileIds);
    return { id, status: dto.decision, documentsDeleted: result.fileIds.length - purgeFailed };
  }

  async revoke(adminId: string, userId: string, dto: VerificationRevokeDto) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Indiquez le motif au professionnel.');
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, professionalVerified: true },
        data: { professionalVerified: false },
      });
      if (!changed.count) throw new ConflictException('Ce compte n’est pas vérifié.');
      await tx.professionalProfile.updateMany({ where: { userId }, data: { verified: false } });
      await tx.auditLog.create({
        data: { actorUserId: adminId, module: 'users', targetType: 'user', targetId: userId, action: 'verification.revoked', metadata: { reason } },
      });
      const notification = await tx.notification.create({
        data: {
          userId,
          module: 'users',
          type: 'verification_revoked',
          title: 'Badge de vérification retiré',
          message: `Le badge « Professionnel vérifié » a été retiré de votre profil. Motif : ${reason}`,
          targetUrl: OWNER_PAGE,
        },
      });
      await queueBusinessEmail(tx, 'verification_decision', notification.id, userId, OWNER_PAGE);
      return { userId, verified: false };
    });
  }
}
