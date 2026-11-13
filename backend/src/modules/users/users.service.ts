import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { FileAsset } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { UpdateUserProfileDto } from './users.dto';
import { findAccountDeletionBlockers } from './account-deletion-policy';

type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        avatarUrl: true,
        emailVerified: true,
        businessEmailsEnabled: true,
        phoneVerified: true,
        identityVerified: true,
        professionalVerified: true,
        createdAt: true,
      },
    });
  }

  deletionBlockers(id: string) {
    return this.prisma.$transaction(tx => findAccountDeletionBlockers(tx, id), {
      isolationLevel: 'RepeatableRead',
    });
  }

  setBusinessEmailPreference(id: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id, deletedAt: null, status: 'active' },
      data: { businessEmailsEnabled: enabled },
      select: { businessEmailsEnabled: true },
    });
  }

  async deleteAccount(id: string, sessionId: string, password: string) {
    const credentials = await this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
    if (!credentials?.passwordHash || !(await bcrypt.compare(password, credentials.passwordHash)))
      throw new BadRequestException('Vérifiez le mot de passe actuel.');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
      const user = await tx.user.findUnique({ where: { id } });
      const session = await tx.userSession.findFirst({ where: { id: sessionId, userId: id, revokedAt: null } });
      if (!user || !session || user.status !== 'active' || user.deletedAt || user.passwordHash !== credentials.passwordHash)
        throw new UnauthorizedException('Authentification requise.');
      if (user.role === 'admin') throw new ForbiddenException('Un compte administrateur ne peut pas être supprimé depuis cet espace.');
      const blockers = await findAccountDeletionBlockers(tx, id);
      if (blockers.blockedByRequests)
        throw new ConflictException('Clôturez les demandes en cours avant de supprimer votre compte.');
      const now = new Date();
      const owned = { ownerUserId: id, deletedAt: null };
      const withdrawn = { status: 'deleted' as const, deletedAt: now };
      await tx.hotelIntegration.updateMany({ where: { property: { ownerUserId: id } }, data: { status: 'inactive' } });
      await tx.realEstateListing.updateMany({ where: owned, data: withdrawn });
      await tx.hotelProperty.updateMany({ where: owned, data: withdrawn });
      await tx.vehicleListing.updateMany({ where: owned, data: withdrawn });
      await tx.tripListing.updateMany({ where: owned, data: withdrawn });
      await tx.fileAsset.updateMany({ where: { ownerUserId: id, visibility: 'public', deletedAt: null }, data: { visibility: 'private', deletedAt: now } });
      await tx.professionalProfile.deleteMany({ where: { userId: id } });
      await tx.favorite.deleteMany({ where: { userId: id } });
      await tx.savedAlert.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: id } });
      await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
      await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      await tx.user.update({ where: { id }, data: {
        status: 'deleted', deletedAt: now, passwordHash: null, email: null, phone: null, businessEmailsEnabled: false,
        firstName: null, lastName: null, city: null, avatarUrl: null,
        emailVerified: false, phoneVerified: false, identityVerified: false, professionalVerified: false,
      } });
      await tx.auditLog.create({ data: { actorUserId: id, module: 'users', action: 'account.deleted' } });
      return { deleted: true };
    }, { timeout: 15000 });
  }

  async updateProfile(id: string, dto: UpdateUserProfileDto) {
    await this.prisma.user.update({
      where: { id, status: 'active', deletedAt: null },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        city: dto.city,
      },
      select: {
        id: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        avatarUrl: true,
      },
    });
    return this.findById(id);
  }

  async uploadAvatar(id: string, file: UploadedImage) {
    let asset: FileAsset | undefined;
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
          const current = await tx.user.findUniqueOrThrow({
            where: { id, status: 'active', deletedAt: null },
            select: { avatarUrl: true },
          });
          asset = await this.filesService.uploadPublicImage(
            id,
            file,
            'avatar',
            tx,
          );
          const user = await tx.user.update({
            where: { id },
            data: { avatarUrl: asset.publicUrl },
            select: { id: true, avatarUrl: true },
          });
          return { user, previous: current.avatarUrl };
        },
        { maxWait: 10000, timeout: 30000 },
      );
      await this.filesService
        .softDeleteByPublicUrl(id, result.previous, 'avatar')
        .catch(() =>
          this.logger.warn('Nettoyage de l’ancien avatar à reprendre.'),
        );
      return result.user;
    } catch (error) {
      if (asset)
        await this.filesService
          .discardPhotoBinary(asset)
          .catch(() =>
            this.logger.warn(
              'Nettoyage d’un téléversement interrompu à reprendre.',
            ),
          );
      throw error;
    }
  }

  async removeAvatar(id: string) {
    const current = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
      const row = await tx.user.findUniqueOrThrow({
        where: { id, status: 'active', deletedAt: null },
        select: { avatarUrl: true },
      });
      await tx.user.update({ where: { id }, data: { avatarUrl: null } });
      return row;
    });
    await this.filesService
      .softDeleteByPublicUrl(id, current.avatarUrl, 'avatar')
      .catch(() =>
        this.logger.warn('Nettoyage de l’ancien avatar à reprendre.'),
      );
    return { removed: true };
  }
}
