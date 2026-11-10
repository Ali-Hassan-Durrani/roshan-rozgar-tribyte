import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { hmac, normalizePhone, safeEqual, sha256 } from '../common/crypto';
import { AppError, badRequest } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SmsService } from './sms.service';

const OTP_TTL_MS = 5 * 60_000;
const REFRESH_TTL_MS = 7 * 24 * 3600_000;
const DEMO_CODE = '1234';

const demoMode = () => process.env.DEMO_MODE === 'true';
const phoneList = (v?: string) => (v || '').split(',').map((p) => normalizePhone(p.trim())).filter(Boolean) as string[];
const otpError = () => new AppError(HttpStatus.UNAUTHORIZED, 'OTP_INVALID', 'Wrong or expired code');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private sms: SmsService,
  ) {}

  private codeHash(phone: string, code: string) {
    return hmac(process.env.OTP_PEPPER!, `${phone}:${code}`);
  }

  private isDemoPhone(phone: string) {
    return demoMode() && phoneList(process.env.DEMO_PHONES).includes(phone);
  }

  async requestOtp(rawPhone: string, ip?: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw badRequest('INVALID_PHONE');

    const now = Date.now();
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, createdAt: { gt: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (!this.isDemoPhone(phone)) {
      if (recent[0] && now - recent[0].createdAt.getTime() < 60_000) {
        throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Wait 60 seconds before resending');
      }
      if (recent.length >= 5) throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many codes');
      if (ip) {
        const perIp = await this.prisma.otpChallenge.count({
          where: { ip, createdAt: { gt: new Date(now - 3600_000) } },
        });
        if (perIp >= 20) throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many codes');
      }
    }

    const code = this.isDemoPhone(phone) ? DEMO_CODE : randomInt(0, 10000).toString().padStart(4, '0');
    await this.prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.otpChallenge.create({
      data: { phone, codeHash: this.codeHash(phone, code), expiresAt: new Date(now + OTP_TTL_MS), ip },
    });

    if (process.env.OTP_MODE === 'sendpk' && !this.isDemoPhone(phone)) {
      await this.sms.send(phone, `Roshan Rozgar code: ${code}. Valid 5 min. Do not share.`);
      return { ok: true, resendIn: 60 };
    }
    // Demo mode: no SMS; the code is shown in a "Demo OTP" banner only when DEMO_MODE=true.
    return { ok: true, resendIn: 60, ...(demoMode() ? { demoCode: code } : {}) };
  }

  async verifyOtp(rawPhone: string, code: string, role?: 'CUSTOMER' | 'WORKER') {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw otpError();
    const ch = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!ch || ch.attempts >= 5) throw otpError();
    if (!safeEqual(ch.codeHash, this.codeHash(phone, code))) {
      await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw otpError();
    }
    await this.prisma.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const isAdmin = phoneList(process.env.ADMIN_PHONES).includes(phone);
      if (!isAdmin && !role) throw badRequest('ROLE_REQUIRED', 'Choose customer or worker');
      const newRole: Role = isAdmin ? 'ADMIN' : role!;
      user = await this.prisma.user.create({
        data: {
          phone,
          role: newRole,
          lang: newRole === 'WORKER' ? 'UR' : 'EN',
          ...(newRole === 'WORKER' ? { worker: { create: {} } } : {}),
          ...(newRole === 'CUSTOMER' ? { customer: { create: {} } } : {}),
        },
      });
    }
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    return { user, ...(await this.issueTokens(user)) };
  }

  async issueTokens(user: User) {
    const access = await this.jwt.signAsync(
      { sub: user.id, role: user.role, phone: user.phone },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );
    const refresh = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha256(refresh), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { access, refresh };
  }

  /** Rotates the refresh token; reuse of a revoked token revokes the whole family. */
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    const rt = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!rt) throw new UnauthorizedException();
    if (rt.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: rt.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }
    if (rt.expiresAt < new Date() || !rt.user.isActive) throw new UnauthorizedException();
    await this.prisma.refreshToken.update({ where: { id: rt.id }, data: { revokedAt: new Date() } });
    return { user: rt.user, ...(await this.issueTokens(rt.user)) };
  }

  async logout(token?: string) {
    if (token) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { worker: { select: { id: true, status: true, availability: true, activeBookingId: true } }, customer: true },
    });
    return {
      id: u.id,
      phone: u.phone,
      role: u.role,
      name: u.name,
      lang: u.lang,
      worker: u.worker,
      customer: u.customer,
      demoMode: demoMode(),
    };
  }
}
