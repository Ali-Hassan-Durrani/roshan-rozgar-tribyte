import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Public, Roles } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { AuthService } from './auth.service';
import { OtpRequestDto, OtpVerifyDto, UpdateMeDto } from './dto';

const base: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
const ACCESS = { ...base, path: '/', maxAge: 15 * 60_000 };
const REFRESH = { ...base, path: '/api/v1/auth', maxAge: 7 * 24 * 3600_000 };

function setCookies(res: Response, t: { access: string; refresh: string }) {
  res.cookie('rr_at', t.access, ACCESS);
  res.cookie('rr_rt', t.refresh, REFRESH);
}

@Controller()
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/otp/request')
  @HttpCode(200)
  request(@Body() dto: OtpRequestDto, @Req() req: Request) {
    return this.auth.requestOtp(dto.phone, req.ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/otp/verify')
  @HttpCode(200)
  async verify(@Body() dto: OtpVerifyDto, @Res({ passthrough: true }) res: Response) {
    const { user, ...tokens } = await this.auth.verifyOtp(dto.phone, dto.code, dto.role);
    setCookies(res, tokens);
    return this.auth.me(user.id);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, ...tokens } = await this.auth.refresh(req.cookies?.rr_rt);
    setCookies(res, tokens);
    return this.auth.me(user.id);
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.rr_rt);
    res.clearCookie('rr_at', { path: '/' });
    res.clearCookie('rr_rt', { path: '/api/v1/auth' });
    return { ok: true };
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Get('auth/me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Patch('users/me')
  async updateMe(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    await this.prisma.user.update({ where: { id: u.id }, data: dto });
    return this.auth.me(u.id);
  }
}
