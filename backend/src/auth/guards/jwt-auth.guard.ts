import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic && (!optional || request.headers.authorization === undefined)) return true;
    const token = this.extractToken(request);
    const user = await this.authService.validateAccessToken(token);
    request.user = user;
    return true;
  }

  private extractToken(request: Request): string {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return '';
    return authorization.slice('Bearer '.length);
  }
}
