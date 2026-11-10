import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WorkerProfile } from '@prisma/client';
import { AiClient } from '../ai/ai-client.service';
import { encrypt, hmac, maskPhone } from '../common/crypto';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { distanceKm, sectorPoint } from '../common/geo';
import { PrismaService } from '../common/prisma.service';
import { cleanImage, sniffImage } from '../common/uploads';
import { ProfileDto, SearchDto } from './dto';

/** Token-sorted similarity 0–100 (rapidfuzz token_sort_ratio equivalent). */
function nameScore(a = '', b = '') {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean).sort().join(' ');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  const d: number[][] = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return Math.round((1 - d[x.length][y.length] / Math.max(x.length, y.length)) * 100);
}

const parseDate = (s?: string) => {
  const m = s?.match(/(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
  if (!m) return undefined;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  // OCR misreads like 31.02.1990 or 14.13.1990 count as "unreadable", never as a crash.
  const valid = year >= 1900 && year <= 2100 && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  return valid ? d : undefined;
};

@Injectable()
export class WorkersService {
  private log = new Logger('Workers');

  constructor(
    private prisma: PrismaService,
    private ai: AiClient,
  ) {}

  private async mine(userId: string) {
    const w = await this.prisma.workerProfile.findUnique({ where: { userId }, include: { user: true, cnic: true } });
    if (!w) throw notFound('Worker profile not found');
    return w;
  }

  private completeness(w: WorkerProfile & { user: { name: string | null }; cnic: unknown }) {
    const profile = !!(w.user.name && w.trade && w.experienceYears != null && w.areas.length && w.baseRate);
    return { phone: true, profile, photo: !!w.photoMediaId, cnic: !!w.cnic };
  }

  async me(userId: string) {
    const w = await this.mine(userId);
    const workPhotos = await this.prisma.media.findMany({
      where: { ownerId: userId, kind: 'WORK_PHOTO' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const activeBooking = w.activeBookingId
      ? await this.prisma.booking.findUnique({
          where: { id: w.activeBookingId },
          select: { id: true, code: true, status: true, trade: true, area: true, agreedPrice: true },
        })
      : null;
    const { cnic, user, ...rest } = w;
    return {
      ...rest,
      name: user.name,
      phone: user.phone,
      lang: user.lang,
      cnic: cnic ? { masked: `xxxxx-xxxxxxx-${cnic.last4.slice(-1)}`, checks: cnic.checks } : null,
      workPhotoIds: workPhotos.map((p) => p.id),
      completeness: this.completeness(w),
      activeBooking,
    };
  }

  private assertEditable(w: WorkerProfile) {
    if (w.status !== 'ONBOARDING' && w.status !== 'REJECTED') throw conflict('INVALID_STATE', 'Profile is locked');
  }

  async saveProfile(userId: string, dto: ProfileDto) {
    const w = await this.mine(userId);
    this.assertEditable(w);
    const p = sectorPoint(dto.areas[0]);
    await this.prisma.user.update({ where: { id: userId }, data: { name: dto.name } });
    await this.prisma.workerProfile.update({
      where: { id: w.id },
      data: {
        trade: dto.trade,
        experienceYears: dto.experienceYears,
        areas: dto.areas,
        baseRate: dto.baseRate,
        workHours: dto.workHours,
        voiceTranscript: dto.voiceTranscript,
        ...(p ? { lat: p[0], lng: p[1] } : {}),
      },
    });
    return this.me(userId);
  }

  async savePhoto(userId: string, file: Express.Multer.File, kind: 'PHOTO' | 'WORK_PHOTO') {
    const w = await this.mine(userId);
    this.assertEditable(w);
    const img = await cleanImage(file.buffer);
    const m = await this.prisma.media.create({
      data: { ownerId: userId, kind, ...img },
    });
    if (kind === 'PHOTO') await this.prisma.workerProfile.update({ where: { id: w.id }, data: { photoMediaId: m.id } });
    return { id: m.id };
  }

  async saveCnic(userId: string, front: Express.Multer.File, back: Express.Multer.File) {
    const w = await this.mine(userId);
    this.assertEditable(w);
    sniffImage(front.buffer);
    sniffImage(back.buffer);
    const ocr = await this.ai.ocrCnic(front.buffer, back.buffer);
    if (!ocr) throw conflict('AI_UNAVAILABLE', 'Could not read the card right now. Try again.');

    const number = ocr.cnicNumber;
    const dob = parseDate(ocr.dob);
    const expiry = parseDate(ocr.expiry);
    const score = nameScore(ocr.name, w.user.name ?? '');
    const numberHmac = number ? hmac(process.env.CNIC_HMAC_KEY!, number) : '';
    const taken = number
      ? await this.prisma.cnic.findFirst({ where: { numberHmac, workerId: { not: w.id } }, select: { id: true } })
      : null;
    const checks = {
      format: !!number && /^\d{5}-\d{7}-\d$/.test(number),
      frontBackMatch: !ocr.backCnicNumber || ocr.backCnicNumber === number,
      notExpired: !expiry || expiry > new Date(),
      adult: !dob || Date.now() - dob.getTime() >= 18 * 365.25 * 24 * 3600_000,
      nameMatch: score >= 70,
      quality: ocr.confidence >= 60,
      unique: !taken,
    };
    const masked = number ? `xxxxx-xxxxxxx-${number.slice(-1)}` : null;
    // Hard requirements to store; the rest are shown to the admin for review.
    const ok = checks.format && checks.unique && checks.notExpired && checks.adult;
    if (!ok) return { ok, checks, masked };

    try {
      const [f, b] = await Promise.all(
        [
          [front, 'CNIC_FRONT'],
          [back, 'CNIC_BACK'],
        ].map(async ([file, kind]: any) =>
          this.prisma.media.create({ data: { ownerId: userId, kind, ...(await cleanImage(file.buffer)) } }),
        ),
      );
      const data = {
        numberEnc: encrypt(process.env.CNIC_ENC_KEY!, number!),
        numberHmac,
        last4: number!.slice(-4),
        nameOnCard: ocr.name?.slice(0, 80) ?? null,
        fatherName: ocr.fatherName?.slice(0, 80) ?? null,
        dob,
        expiry,
        frontMediaId: f.id,
        backMediaId: b.id,
        ocrConfidence: Number(ocr.confidence) || 0,
        nameMatchScore: score,
        checks,
      };
      await this.prisma.cnic.upsert({ where: { workerId: w.id }, create: { workerId: w.id, ...data }, update: data });
    } catch (e) {
      // Never log the CNIC values themselves.
      this.log.error(`CNIC save failed for worker ${w.id}: ${(e as Error).name} ${(e as Error).message.split('\n').slice(-2).join(' ')}`);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: false, checks: { ...checks, unique: false }, masked };
      }
      throw conflict('CNIC_SAVE_FAILED', 'Could not save the card. Please try again.');
    }
    return { ok, checks, masked };
  }

  async submit(userId: string) {
    const w = await this.mine(userId);
    this.assertEditable(w);
    const c = this.completeness(w);
    const missing = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw badRequest('INCOMPLETE', `Missing: ${missing.join(', ')}`);
    await this.prisma.workerProfile.update({ where: { id: w.id }, data: { status: 'PENDING_REVIEW', rejectReason: null } });
    return this.me(userId);
  }

  async setAvailability(userId: string, availability: 'AVAILABLE' | 'OFFLINE') {
    const w = await this.mine(userId);
    if (w.status !== 'VERIFIED') throw conflict('NOT_VERIFIED', 'Wait for admin approval');
    if (w.activeBookingId) throw conflict('HAS_ACTIVE_JOB', 'Finish your current job first');
    const r = await this.prisma.workerProfile.updateMany({
      where: { id: w.id, activeBookingId: null, status: 'VERIFIED' },
      data: { availability },
    });
    if (r.count !== 1) throw conflict('HAS_ACTIVE_JOB');
    return this.me(userId);
  }

  async requests(userId: string) {
    const w = await this.mine(userId);
    if (w.status !== 'VERIFIED') return [];
    return this.prisma.booking.findMany({
      where: { workerId: w.id, status: { in: ['REQUESTED', 'NEGOTIATING'] } },
      orderBy: { createdAt: 'desc' },
      include: { customer: { include: { user: { select: { name: true } } } } },
    });
  }

  async earnings(userId: string) {
    const w = await this.mine(userId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sum = (where: Prisma.BookingWhereInput) =>
      this.prisma.booking.aggregate({
        where: { workerId: w.id, status: 'COMPLETED', ...where },
        _sum: { agreedPrice: true },
        _count: true,
      });
    const [today, week, all] = await Promise.all([
      sum({ completedAt: { gte: startOfDay } }),
      sum({ completedAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } }),
      sum({}),
    ]);
    const fmt = (a: typeof today) => ({ amount: a._sum.agreedPrice ?? 0, jobs: a._count });
    return { today: fmt(today), week: fmt(week), all: fmt(all), rating: w.ratingAvg, ratingCount: w.ratingCount };
  }

  async search(q: SearchDto, userId?: string) {
    let { lat, lng } = q;
    if (lat == null || lng == null) {
      const p = sectorPoint(q.area);
      const c = userId ? await this.prisma.customerProfile.findUnique({ where: { userId } }) : null;
      lat = p?.[0] ?? c?.lat ?? 33.6845;
      lng = p?.[1] ?? c?.lng ?? 73.0136;
    }
    const radius = q.radiusKm ?? 15;
    const rows = await this.prisma.workerProfile.findMany({
      where: {
        status: 'VERIFIED',
        user: { isActive: true },
        ...(q.trade ? { trade: q.trade } : {}),
        ...(q.availableNow ? { availability: 'AVAILABLE' } : { availability: { in: ['AVAILABLE', 'BUSY'] } }),
        ...(q.minRating ? { ratingAvg: { gte: q.minRating } } : {}),
      },
      include: { user: { select: { name: true, phone: true } } },
    });
    const list = rows
      .map((w) => {
        const d = w.lat != null && w.lng != null ? distanceKm(lat!, lng!, w.lat, w.lng) : 99;
        return { ...this.publicCard(w), distanceKm: Math.round(d * 10) / 10, etaMin: Math.max(5, Math.round(d * 4 + 5)) };
      })
      .filter((w) => w.distanceKm <= radius);
    const sort = q.sort ?? 'best';
    list.sort((a, b) => {
      if (a.availability !== b.availability) return a.availability === 'AVAILABLE' ? -1 : 1;
      if (sort === 'distance') return a.distanceKm - b.distanceKm;
      if (sort === 'price') return (a.baseRate ?? 0) - (b.baseRate ?? 0);
      return b.ratingAvg * 2 - a.distanceKm * 0.3 - (a.ratingAvg * 2 - b.distanceKm * 0.3);
    });
    return { center: { lat, lng }, workers: list };
  }

  publicCard(w: WorkerProfile & { user: { name: string | null; phone: string } }) {
    return {
      id: w.id,
      name: w.user.name,
      phoneMasked: maskPhone(w.user.phone),
      trade: w.trade,
      experienceYears: w.experienceYears,
      areas: w.areas,
      baseRate: w.baseRate,
      workHours: w.workHours,
      availability: w.availability,
      ratingAvg: Math.round(w.ratingAvg * 10) / 10,
      ratingCount: w.ratingCount,
      jobsDone: w.jobsDone,
      photoMediaId: w.photoMediaId,
      lat: w.lat,
      lng: w.lng,
      verified: w.status === 'VERIFIED',
    };
  }

  async publicProfile(id: string, viewerId?: string) {
    const w = await this.prisma.workerProfile.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!w) throw notFound();
    if (w.status !== 'VERIFIED' && w.userId !== viewerId) throw forbidden();
    const [aspects, reviews, workPhotos] = await Promise.all([
      this.prisma.review.aggregate({
        where: { workerId: id, status: 'PUBLISHED' },
        _avg: { quality: true, onTime: true, fairPrice: true, behaviour: true },
      }),
      this.prisma.review.findMany({
        where: { workerId: id, status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, overall: true, tags: true, text: true, voiceId: true, transcript: true, createdAt: true,
          booking: { select: { customer: { select: { user: { select: { name: true } } } } } },
        },
      }),
      this.prisma.media.findMany({ where: { ownerId: w.userId, kind: 'WORK_PHOTO' }, select: { id: true } }),
    ]);
    const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
    return {
      ...this.publicCard(w),
      aiSummary: w.aiSummary,
      aspects: {
        quality: r1(aspects._avg.quality),
        onTime: r1(aspects._avg.onTime),
        fairPrice: r1(aspects._avg.fairPrice),
        behaviour: r1(aspects._avg.behaviour),
      },
      workPhotoIds: workPhotos.map((p) => p.id),
      reviews: reviews.map(({ booking, ...r }) => ({ ...r, customerName: booking.customer.user.name })),
    };
  }
}
