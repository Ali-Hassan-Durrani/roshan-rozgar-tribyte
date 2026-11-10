import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BookingStatus, WorkerStatus } from '@prisma/client';
import { IsOptional, IsString, Length } from 'class-validator';
import { audit } from '../common/audit';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Roles } from '../common/auth';
import { decrypt, maskPhone } from '../common/crypto';
import { conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';

class ReasonDto {
  @IsOptional()
  @IsString()
  @Length(2, 300)
  reason?: string;
}

@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const [workers, available, busy, pending, customers, bookingsToday, active, completed, flagged, doubles, revenue] =
      await Promise.all([
        this.prisma.workerProfile.count({ where: { status: 'VERIFIED' } }),
        this.prisma.workerProfile.count({ where: { status: 'VERIFIED', availability: 'AVAILABLE' } }),
        this.prisma.workerProfile.count({ where: { availability: 'BUSY' } }),
        this.prisma.workerProfile.count({ where: { status: 'PENDING_REVIEW' } }),
        this.prisma.customerProfile.count(),
        this.prisma.booking.count({ where: { createdAt: { gte: day } } }),
        this.prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS'] } } }),
        this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
        this.prisma.review.count({ where: { flagged: true, status: 'PUBLISHED' } }),
        this.prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*)::bigint AS n FROM (
            SELECT "workerId" FROM "Booking" WHERE status IN ('CONFIRMED','IN_PROGRESS')
            GROUP BY "workerId" HAVING COUNT(*) > 1) t`,
        this.prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { agreedPrice: true } }),
      ]);
    const since = new Date(Date.now() - 6 * 24 * 3600_000);
    since.setHours(0, 0, 0, 0);
    const recent = await this.prisma.booking.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
    const perDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since.getTime() + i * 24 * 3600_000);
      const key = d.toISOString().slice(0, 10);
      return { date: key, bookings: recent.filter((r) => r.createdAt.toISOString().slice(0, 10) === key).length };
    });
    return {
      workers, available, busy, pending, customers, bookingsToday, active, completed, flagged,
      doubleBookings: Number(doubles[0]?.n ?? 0),
      revenue: revenue._sum.agreedPrice ?? 0,
      perDay,
    };
  }

  @Get('workers')
  async workers(@Query('status') status?: string) {
    const rows = await this.prisma.workerProfile.findMany({
      where: status ? { status: status as WorkerStatus } : {},
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { name: true, phone: true } }, cnic: { select: { last4: true, checks: true, nameMatchScore: true, ocrConfidence: true } } },
    });
    return rows.map(({ user, cnic, voiceTranscript: _t, ...w }) => ({
      ...w,
      name: user.name,
      phoneMasked: maskPhone(user.phone),
      cnic: cnic && { masked: `xxxxx-xxxxxxx-${cnic.last4.slice(-1)}`, checks: cnic.checks, nameMatchScore: cnic.nameMatchScore, ocrConfidence: cnic.ocrConfidence },
    }));
  }

  @Get('workers/:id')
  async worker(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const w = await this.prisma.workerProfile.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } }, cnic: true },
    });
    if (!w) throw notFound();
    await audit(this.prisma, u.id, 'VIEW_WORKER', 'WorkerProfile', id);
    const { cnic, user, ...rest } = w;
    let masked: string | null = null;
    if (cnic) {
      const n = decrypt(process.env.CNIC_ENC_KEY!, cnic.numberEnc);
      masked = `${n.slice(0, 5)}-xxxxxxx-${n.slice(-1)}`;
    }
    return {
      ...rest,
      name: user.name,
      phoneMasked: maskPhone(user.phone),
      cnic: cnic && {
        masked,
        nameOnCard: cnic.nameOnCard,
        checks: cnic.checks,
        ocrConfidence: cnic.ocrConfidence,
        nameMatchScore: cnic.nameMatchScore,
        frontMediaId: cnic.frontMediaId,
        backMediaId: cnic.backMediaId,
        expiry: cnic.expiry,
      },
    };
  }

  private async setStatus(u: AuthUser, id: string, from: WorkerStatus[], to: WorkerStatus, reason?: string) {
    const w = await this.prisma.workerProfile.findUnique({ where: { id } });
    if (!w) throw notFound();
    if (!from.includes(w.status)) throw conflict('INVALID_STATE', `Worker is ${w.status}`);
    const extra = to === 'SUSPENDED' && !w.activeBookingId ? { availability: 'OFFLINE' as const } : {};
    await this.prisma.workerProfile.update({
      where: { id },
      data: { status: to, rejectReason: to === 'REJECTED' ? reason : null, ...(to === 'VERIFIED' ? {} : extra) },
    });
    await audit(this.prisma, u.id, `WORKER_${to}`, 'WorkerProfile', id, { reason });
    return { ok: true, status: to };
  }

  @Post('workers/:id/approve')
  approve(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.setStatus(u, id, ['PENDING_REVIEW', 'REJECTED', 'SUSPENDED'], 'VERIFIED');
  }

  @Post('workers/:id/reject')
  reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.setStatus(u, id, ['PENDING_REVIEW'], 'REJECTED', dto.reason);
  }

  @Post('workers/:id/suspend')
  suspend(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.setStatus(u, id, ['VERIFIED'], 'SUSPENDED', dto.reason);
  }

  @Get('bookings')
  async bookings(@Query('status') status?: string) {
    const rows = await this.prisma.booking.findMany({
      where: status ? { status: { in: status.split(',') as BookingStatus[] } } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        worker: { select: { id: true, availability: true, activeBookingId: true, user: { select: { name: true } } } },
        customer: { select: { user: { select: { name: true } } } },
      },
    });
    return rows.map(({ startCodeHash: _h, worker, customer, ...b }) => ({
      ...b,
      workerName: worker.user.name,
      workerNow: worker.availability,
      workerActiveHere: worker.activeBookingId === b.id,
      customerName: customer.user.name,
    }));
  }

  @Get('reviews')
  async reviews(@Query('flagged') flagged?: string) {
    const rows = await this.prisma.review.findMany({
      where: flagged === 'true' ? { flagged: true } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { booking: { select: { code: true, worker: { select: { user: { select: { name: true } } } }, customer: { select: { user: { select: { name: true } } } } } } },
    });
    return rows.map(({ booking, ...r }) => ({
      ...r,
      bookingCode: booking.code,
      workerName: booking.worker.user.name,
      customerName: booking.customer.user.name,
    }));
  }

  private async reviewStatus(u: AuthUser, id: string, hide: boolean) {
    const r = await this.prisma.review.update({
      where: { id },
      data: hide ? { status: 'HIDDEN' } : { status: 'PUBLISHED', flagged: false },
    });
    const agg = await this.prisma.review.aggregate({
      where: { workerId: r.workerId, status: 'PUBLISHED' },
      _avg: { overall: true },
      _count: true,
    });
    await this.prisma.workerProfile.update({
      where: { id: r.workerId },
      data: { ratingAvg: agg._avg.overall ?? 0, ratingCount: agg._count },
    });
    await audit(this.prisma, u.id, hide ? 'REVIEW_HIDE' : 'REVIEW_KEEP', 'Review', id);
    return { ok: true };
  }

  @Post('reviews/:id/hide')
  hide(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.reviewStatus(u, id, true);
  }

  @Post('reviews/:id/keep')
  keep(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.reviewStatus(u, id, false);
  }

  @Get('audit')
  auditLog() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
