import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AccountStatus, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma/prisma.service';
import { getPermissionsForRole } from '../common/constants/permissions';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string) {
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
    const storedToken = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée.');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.id } });
    return this.issueTokens({ id: user.id, role: user.role }, undefined, storedToken.sessionId);
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

  async logout(sessionId?: string) {
    if (!sessionId) return { revoked: false };
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async forgotPassword(_dto: ForgotPasswordDto) {
    return { sent: true };
  }

  async resetPassword(_dto: ResetPasswordDto) {
    return { updated: false };
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      const session = payload.sessionId
        ? await this.prisma.userSession.findUnique({ where: { id: payload.sessionId } })
        : null;
      if (payload.sessionId && (!session || session.revokedAt)) {
        throw new UnauthorizedException('Session révoquée.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Authentification requise.');
    }
  }

  private async issueTokens(user: Pick<AuthenticatedUser, 'id' | 'role'>, userAgent?: string, existingSessionId?: string) {
    const session = existingSessionId
      ? await this.prisma.userSession.update({
          where: { id: existingSessionId },
          data: { lastUsedAt: new Date() },
        })
      : await this.prisma.userSession.create({
          data: {
            userId: user.id,
            userAgent,
            lastUsedAt: new Date(),
          },
        });

    const accessOptions = {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    } as JwtSignOptions;
    const refreshOptions = {
      secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '30d',
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
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<AuthenticatedUser> {
    try {
      return await this.jwtService.verifyAsync<AuthenticatedUser>(refreshToken, {
        secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expirée.');
    }
  }

  private async hashToken(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }
}
