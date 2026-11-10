import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { forbidden } from './errors';
import { PrismaService } from './prisma.service';

export interface AuthUser {
  id: string;
  role: Role;
  phone: string;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
/** Route needs no login (every other route is deny-by-default). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user as AuthUser,
);

/** Global guard: JWT from httpOnly cookie, active-user check, role check, CSRF header on writes. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const targets = [ctx.getHandler(), ctx.getClass()];

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.endsWith('/vapi/webhook')) {
      if (req.headers['x-requested-with'] !== 'roshan') throw forbidden('Missing CSRF header');
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const token = req.cookies?.rr_at;
    if (token) {
      try {
        const p = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
        req.user = { id: p.sub, role: p.role, phone: p.phone };
      } catch {
        // expired or invalid → anonymous
      }
    }
    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Login required');

    const user = await this.prisma.user.findUnique({ where: { id: req.user.id }, select: { isActive: true } });
    if (!user?.isActive) throw new UnauthorizedException('Account disabled');

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (!roles?.length) throw forbidden('Route has no role policy');
    if (!roles.includes(req.user.role)) throw forbidden();
    return true;
  }
}
