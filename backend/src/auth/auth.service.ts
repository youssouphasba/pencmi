import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AccountStatus, Prisma, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma/prisma.service';
import { getPermissionsForRole } from '../common/constants/permissions';
import { PUBLIC_REGISTRATION_ROLES } from '../common/constants/roles';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

type SessionClaims = { id: string; sessionId: string; exp: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
    if (!PUBLIC_REGISTRATION_ROLES.includes(dto.role)) {
      throw new BadRequestException('Type de compte non autorisé pour cette inscription.');
    }
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Un email ou un téléphone est obligatoire.');
    }
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email ?? undefined }, { phone: dto.phone ?? undefined }],
      },
    });
    if (existingUser) {
      throw new ConflictException('Un compte existe déjà avec ces informations.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        role: dto.role as UserRole,
        status: AccountStatus.active,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    return this.issueTokens({ id: user.id, role: user.role }, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        deletedAt: null,
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk || user.status !== AccountStatus.active) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }
    return this.issueTokens({ id: user.id, role: user.role }, userAgent);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = await this.hashToken(refreshToken);
    return this.prisma.$transaction(async (tx) => {
      const session = await this.getActiveSession(payload, tx);
      // Serialize refresh and logout on the same session row.
      const locked = await tx.userSession.updateMany({
        where: { id: payload.sessionId, userId: payload.id, revokedAt: null, user: { status: AccountStatus.active, deletedAt: null } },
        data: { lastUsedAt: new Date() },
      });
      if (locked.count !== 1) throw new UnauthorizedException('Session expirée.');
      this.assertSessionClaims(payload);
      const storedToken = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()
        || storedToken.userId !== payload.id || storedToken.sessionId !== payload.sessionId) {
        throw new UnauthorizedException('Session expirée.');
      }
      return this.issueTokens({ id: session.user.id, role: session.user.role }, undefined, session.id, tx);
    });
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
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
        phoneVerified: true,
        identityVerified: true,
        professionalVerified: true,
      },
    });
    return {
      ...user,
      permissions: getPermissionsForRole(user.role),
    };
  }

  async logout(userId: string, sessionId: string) {
    if (typeof userId !== 'string' || !userId.trim() || typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new UnauthorizedException('Authentification requise.');
    }
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.userSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
      if (!session || session.userId !== userId) throw new UnauthorizedException('Authentification requise.');
      const revokedAt = new Date();
      await tx.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId, userId, revokedAt: null }, data: { revokedAt },
      });
      return { revoked: true };
    });
  }

  async forgotPassword(_dto: ForgotPasswordDto) {
    return { sent: true };
  }

  async resetPassword(_dto: ResetPasswordDto) {
    return { updated: false };
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<SessionClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
      });
      this.assertSessionClaims(payload);
      const session = await this.getActiveSession(payload, this.prisma);
      return { id: session.user.id, role: session.user.role, sessionId: session.id };
    } catch {
      throw new UnauthorizedException('Authentification requise.');
    }
  }

  private async issueTokens(user: Pick<AuthenticatedUser, 'id' | 'role'>, userAgent?: string, existingSessionId?: string, db: Prisma.TransactionClient = this.prisma) {
    const session = existingSessionId
      ? { id: existingSessionId }
      : await db.userSession.create({
          data: {
            userId: user.id,
            userAgent,
            lastUsedAt: new Date(),
          },
        });

    const accessOptions = {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      jwtid: randomUUID(),
    } as JwtSignOptions;
    const refreshOptions = {
      secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '30d',
      jwtid: randomUUID(),
    } as JwtSignOptions;
    const accessToken = await this.jwtService.signAsync(
      { id: user.id, role: user.role, sessionId: session.id },
      accessOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      { id: user.id, role: user.role, sessionId: session.id },
      refreshOptions,
    );
    const tokenHash = await this.hashToken(refreshToken);
    const refreshClaims = this.jwtService.decode<{ exp: number }>(refreshToken);
    if (!refreshClaims || !Number.isFinite(refreshClaims.exp)) throw new UnauthorizedException('Session expirée.');
    await db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        expiresAt: new Date(refreshClaims.exp * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<SessionClaims> {
    try {
      const payload = await this.jwtService.verifyAsync<SessionClaims>(refreshToken, {
        secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
        algorithms: ['HS256'],
      });
      this.assertSessionClaims(payload);
      return payload;
    } catch {
      throw new UnauthorizedException('Session expirée.');
    }
  }

  private assertSessionClaims(payload: unknown): asserts payload is SessionClaims {
    const claims = payload as Partial<SessionClaims> | null;
    if (!claims || typeof claims.id !== 'string' || !claims.id.trim()
      || typeof claims.sessionId !== 'string' || !claims.sessionId.trim()
      || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
      throw new UnauthorizedException('Authentification requise.');
    }
  }

  private async getActiveSession(payload: SessionClaims, db: Prisma.TransactionClient) {
    const session = await db.userSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true, userId: true, revokedAt: true,
        user: { select: { id: true, role: true, status: true, deletedAt: true } },
      },
    });
    if (!session || session.userId !== payload.id || session.revokedAt || !session.user
      || session.user.id !== payload.id || session.user.status !== AccountStatus.active || session.user.deletedAt) {
      throw new UnauthorizedException('Authentification requise.');
    }
    return session;
  }

  private async hashToken(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }
}
