import { Injectable, Logger } from '@nestjs/common';
import { Booking, BookingStatus, Party, Prisma } from '@prisma/client';
import { AiClient } from '../ai/ai-client.service';
import { AuthUser } from '../common/auth';
import { hmac, maskPhone, safeEqual } from '../common/crypto';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { sectorPoint } from '../common/geo';
import { PrismaService } from '../common/prisma.service';
import { CreateBookingDto, MessageDto, ReviewDto } from './dto';

type Tx = Prisma.TransactionClient;

/** The customer's start code is derived (never stored in plain text); the worker types it to start. */
const startCode = (bookingId: string) =>
  (parseInt(hmac(process.env.OTP_PEPPER!, `start:${bookingId}`).slice(0, 8), 16) % 10000).toString().padStart(4, '0');
const startCodeHash = (bookingId: string, code: string) => hmac(process.env.OTP_PEPPER!, `startcode:${bookingId}:${code}`);

const PRICE_RE = /(\d{3,6})\s*(?:rs|rupay|rupees|rupee|روپے|pkr)|(?:rs\.?|pkr)\s*(\d{3,6})/i;

@Injectable()
export class BookingsService {
  private log = new Logger('Bookings');

  constructor(
    private prisma: PrismaService,
    private ai: AiClient,
  ) {}

  private async load(id: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: { select: { userId: true } }, worker: { select: { userId: true } } },
    });
    if (!b) throw notFound('Booking not found');
    return b;
  }

  private partyOf(u: AuthUser, b: { customer: { userId: string }; worker: { userId: string } }): Party | null {
    if (b.customer.userId === u.id) return 'CUSTOMER';
    if (b.worker.userId === u.id) return 'WORKER';
    return null;
  }

  private async assertParty(u: AuthUser, id: string, allowAdmin = false) {
    const b = await this.load(id);
    const party = this.partyOf(u, b);
    if (!party && !(allowAdmin && u.role === 'ADMIN')) throw forbidden();
    return { b, party };
  }

  private sys(tx: Tx | PrismaService, bookingId: string, text: string) {
    return tx.message.create({ data: { bookingId, type: 'SYSTEM', text } });
  }

  private assertState(b: Booking, ...allowed: BookingStatus[]) {
    if (!allowed.includes(b.status)) throw conflict('INVALID_STATE', `Booking is ${b.status}`);
  }

  async create(u: AuthUser, dto: CreateBookingDto) {
    const customer = await this.prisma.customerProfile.findUniqueOrThrow({ where: { userId: u.id }, include: { user: true } });
    const address = dto.address ?? customer.address;
    const area = dto.area ?? customer.area;
    if (!customer.user.name || !address || !area) {
      throw badRequest('PROFILE_INCOMPLETE', 'Add your name and address first');
    }
    const worker = await this.prisma.workerProfile.findUnique({ where: { id: dto.workerId } });
    if (!worker || worker.status !== 'VERIFIED' || worker.availability !== 'AVAILABLE' || worker.activeBookingId) {
      throw conflict('WORKER_UNAVAILABLE', 'This worker just got booked. Pick another.');
    }
    for (const mediaId of [dto.problemVoiceId, dto.problemPhotoId].filter(Boolean) as string[]) {
      const m = await this.prisma.media.findUnique({ where: { id: mediaId }, select: { ownerId: true } });
      if (m?.ownerId !== u.id) throw forbidden('Media not yours');
    }
    const open = await this.prisma.booking.count({
      where: { customerId: customer.id, workerId: worker.id, status: { in: ['REQUESTED', 'NEGOTIATING'] } },
    });
    if (open) throw conflict('DUPLICATE_REQUEST', 'You already sent this worker a request');

    const price = await this.ai.price(dto.trade, area);
    const p = sectorPoint(area);
    const b = await this.prisma.booking.create({
      data: {
        code: `RR-${Math.floor(1000 + Math.random() * 9000)}${Date.now().toString().slice(-2)}`,
        customerId: customer.id,
        workerId: worker.id,
        trade: dto.trade,
        problemText: dto.problemText,
        problemVoiceId: dto.problemVoiceId,
        problemPhotoId: dto.problemPhotoId,
        urgency: dto.urgency,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        address,
        area,
        lat: dto.lat ?? customer.lat ?? p?.[0],
        lng: dto.lng ?? customer.lng ?? p?.[1],
        aiPriceMin: price.priceMin,
        aiPriceMax: price.priceMax,
      },
    });
    await this.sys(this.prisma, b.id, 'Request sent to worker');
    return this.get(u, b.id);
  }

  async list(u: AuthUser, status?: string) {
    const statuses = status ? (status.split(',') as BookingStatus[]) : undefined;
    const where: Prisma.BookingWhereInput = {
      ...(u.role === 'CUSTOMER' ? { customer: { userId: u.id } } : { worker: { userId: u.id } }),
      ...(statuses ? { status: { in: statuses } } : {}),
    };
    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        worker: { include: { user: { select: { name: true } } } },
        customer: { include: { user: { select: { name: true } } } },
        review: { select: { overall: true } },
      },
    });
    return rows.map((b) => this.view(b, u.role === 'CUSTOMER' ? 'CUSTOMER' : 'WORKER'));
  }

  private view(b: any, party: Party | null) {
    const { startCodeHash: _h, startAttempts: _a, worker, customer, ...rest } = b;
    return {
      ...rest,
      worker: worker && {
        id: worker.id,
        name: worker.user?.name,
        trade: worker.trade,
        ratingAvg: worker.ratingAvg,
        photoMediaId: worker.photoMediaId,
        availability: worker.availability,
        lat: worker.lat,
        lng: worker.lng,
        phoneMasked: worker.user?.phone ? maskPhone(worker.user.phone) : undefined,
      },
      customer: customer && { id: customer.id, name: customer.user?.name },
      // Only the customer ever sees the start code.
      startCode: party === 'CUSTOMER' && ['CONFIRMED'].includes(b.status) ? startCode(b.id) : undefined,
      myParty: party,
    };
  }

  async get(u: AuthUser, id: string) {
    const { party } = await this.assertParty(u, id, true);
    const b = await this.prisma.booking.findUniqueOrThrow({
      where: { id },
      include: {
        worker: { include: { user: { select: { name: true, phone: true } } } },
        customer: { include: { user: { select: { name: true } } } },
        offers: { orderBy: { createdAt: 'desc' } },
        review: true,
      },
    });
    return this.view(b, party);
  }

  async accept(u: AuthUser, id: string) {
    const { b, party } = await this.assertParty(u, id);
    if (party !== 'WORKER') throw forbidden();
    this.assertState(b, 'REQUESTED');
    const w = await this.prisma.workerProfile.findUniqueOrThrow({ where: { id: b.workerId } });
    if (w.status !== 'VERIFIED' || w.activeBookingId) throw conflict('WORKER_UNAVAILABLE', 'Finish your current job first');
    const r = await this.prisma.booking.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'NEGOTIATING' } });
    if (r.count !== 1) throw conflict('INVALID_STATE');
    await this.sys(this.prisma, id, 'Worker accepted the request. Agree on a price.');
    return this.get(u, id);
  }

  async decline(u: AuthUser, id: string, reason: string) {
    const { b, party } = await this.assertParty(u, id);
    if (party !== 'WORKER') throw forbidden();
    this.assertState(b, 'REQUESTED', 'NEGOTIATING');
    await this.prisma.booking.update({
      where: { id },
      data: { status: 'DECLINED', cancelledBy: 'WORKER', cancelReason: reason },
    });
    await this.sys(this.prisma, id, `Worker declined (${reason})`);
    return this.get(u, id);
  }

  async offer(u: AuthUser, id: string, amount: number) {
    const { b, party } = await this.assertParty(u, id);
    if (!party) throw forbidden();
    this.assertState(b, 'NEGOTIATING');
    await this.prisma.$transaction(async (tx) => {
      await tx.priceOffer.updateMany({ where: { bookingId: id, status: 'PENDING' }, data: { status: 'SUPERSEDED' } });
      const o = await tx.priceOffer.create({ data: { bookingId: id, by: party, amount } });
      await tx.message.create({ data: { bookingId: id, senderId: u.id, type: 'PRICE_OFFER', offerId: o.id, text: `Rs ${amount}` } });
    });
    return this.get(u, id);
  }

  /** §12: accepting the other side's offer confirms the booking AND makes the worker BUSY atomically. */
  async acceptOffer(u: AuthUser, id: string, offerId: string) {
    const { party } = await this.assertParty(u, id);
    if (!party) throw forbidden();
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const b = await tx.booking.findUniqueOrThrow({ where: { id } });
          const offer = await tx.priceOffer.findFirst({ where: { id: offerId, bookingId: id } });
          if (!offer) throw notFound('Offer not found');
          if (offer.by === party) throw forbidden('You cannot accept your own offer');
          if (offer.status !== 'PENDING') throw conflict('INVALID_STATE', 'Offer is no longer open');
          if (b.status !== 'NEGOTIATING') throw conflict('INVALID_STATE', `Booking is ${b.status}`);

          const claimed = await tx.workerProfile.updateMany({
            where: { id: b.workerId, status: 'VERIFIED', availability: 'AVAILABLE', activeBookingId: null },
            data: { availability: 'BUSY', activeBookingId: b.id },
          });
          if (claimed.count !== 1) throw conflict('WORKER_UNAVAILABLE', 'This worker just got booked. Pick another.');

          await tx.booking.update({
            where: { id },
            data: { status: 'CONFIRMED', agreedPrice: offer.amount, startCodeHash: startCodeHash(id, startCode(id)) },
          });
          await tx.priceOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
          await tx.message.create({ data: { bookingId: id, type: 'SYSTEM', text: `Booking confirmed at Rs ${offer.amount}` } });

          const others = await tx.booking.findMany({
            where: { workerId: b.workerId, id: { not: id }, status: { in: ['REQUESTED', 'NEGOTIATING'] } },
            select: { id: true },
          });
          if (others.length) {
            await tx.booking.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: 'EXPIRED' } });
            await tx.message.createMany({
              data: others.map((o) => ({ bookingId: o.id, type: 'SYSTEM' as const, text: 'Worker just got booked. Pick another.' })),
            });
          }
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e) {
      // Serialization failure / unique activeBookingId → someone else won the race.
      if (e instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(e.code)) {
        throw conflict('WORKER_UNAVAILABLE', 'This worker just got booked. Pick another.');
      }
      throw e;
    }
    return this.get(u, id);
  }

  async start(u: AuthUser, id: string, code: string) {
    const { b, party } = await this.assertParty(u, id);
    if (party !== 'WORKER') throw forbidden();
    this.assertState(b, 'CONFIRMED');
    if (b.startAttempts >= 5) throw conflict('CODE_LOCKED', 'Too many wrong codes. Ask the customer to call support.');
    if (!b.startCodeHash || !safeEqual(b.startCodeHash, startCodeHash(id, code))) {
      await this.prisma.booking.update({ where: { id }, data: { startAttempts: { increment: 1 } } });
      throw badRequest('CODE_INVALID', 'Wrong start code');
    }
    await this.prisma.booking.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    await this.sys(this.prisma, id, 'Job started');
    return this.get(u, id);
  }

  async complete(u: AuthUser, id: string) {
    const { b, party } = await this.assertParty(u, id);
    if (party !== 'WORKER') throw forbidden();
    this.assertState(b, 'IN_PROGRESS');
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.booking.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (r.count !== 1) throw conflict('INVALID_STATE');
      await tx.workerProfile.update({
        where: { id: b.workerId },
        data: { availability: 'AVAILABLE', activeBookingId: null, jobsDone: { increment: 1 } },
      });
      await tx.message.create({ data: { bookingId: id, type: 'SYSTEM', text: 'Job completed' } });
    });
    return this.get(u, id);
  }

  async cancel(u: AuthUser, id: string, reason: string) {
    const { b, party } = await this.assertParty(u, id);
    if (!party) throw forbidden();
    this.assertState(b, 'REQUESTED', 'NEGOTIATING', 'CONFIRMED');
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.booking.updateMany({
        where: { id, status: b.status },
        data: { status: 'CANCELLED', cancelledBy: party, cancelReason: reason },
      });
      if (r.count !== 1) throw conflict('INVALID_STATE');
      if (b.status === 'CONFIRMED') {
        await tx.workerProfile.updateMany({
          where: { id: b.workerId, activeBookingId: id },
          data: { availability: 'AVAILABLE', activeBookingId: null },
        });
      }
      await tx.message.create({ data: { bookingId: id, type: 'SYSTEM', text: `Cancelled by ${party.toLowerCase()}` } });
    });
    return this.get(u, id);
  }

  async messages(u: AuthUser, id: string, after?: string) {
    await this.assertParty(u, id, true);
    const rows = await this.prisma.message.findMany({
      where: { bookingId: id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const offerIds = rows.map((m) => m.offerId).filter(Boolean) as string[];
    const offers = offerIds.length ? await this.prisma.priceOffer.findMany({ where: { id: { in: offerIds } } }) : [];
    return rows.map((m) => ({ ...m, mine: m.senderId === u.id, offer: offers.find((o) => o.id === m.offerId) }));
  }

  async sendMessage(u: AuthUser, id: string, dto: MessageDto) {
    const { b, party } = await this.assertParty(u, id);
    if (!party) throw forbidden();
    this.assertState(b, 'REQUESTED', 'NEGOTIATING', 'CONFIRMED', 'IN_PROGRESS');
    let transcript: string | undefined;
    if (dto.type === 'VOICE') {
      if (!dto.audioId) throw badRequest('AUDIO_REQUIRED');
      const m = await this.prisma.media.findUnique({ where: { id: dto.audioId } });
      if (!m || m.ownerId !== u.id || m.kind !== 'VOICE') throw forbidden('Media not yours');
      const stt = await this.ai.stt(Buffer.from(m.data), m.mime);
      transcript = stt?.text;
    } else if (!dto.text?.trim()) {
      throw badRequest('TEXT_REQUIRED');
    }
    const content = transcript ?? dto.text ?? '';
    const sender = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { lang: true } });
    const to = sender.lang === 'UR' ? 'en' : 'ur';
    const translation = content ? (await this.ai.translate(content, to))?.text : undefined;
    const msg = await this.prisma.message.create({
      data: {
        bookingId: id,
        senderId: u.id,
        type: dto.type,
        text: dto.text,
        audioId: dto.audioId,
        transcript,
        translation,
        lang: sender.lang,
      },
    });
    // AI price detection → the client shows a one-tap "send as offer" card.
    const pm = content.match(PRICE_RE);
    const suggestedOffer = pm ? Number(pm[1] || pm[2]) : undefined;
    return { ...msg, mine: true, suggestedOffer };
  }

  async review(u: AuthUser, id: string, dto: ReviewDto) {
    const { b, party } = await this.assertParty(u, id);
    if (party !== 'CUSTOMER') throw forbidden();
    this.assertState(b, 'COMPLETED');
    if (await this.prisma.review.findUnique({ where: { bookingId: id } })) throw conflict('ALREADY_REVIEWED');

    let transcript: string | undefined;
    if (dto.voiceId) {
      const m = await this.prisma.media.findUnique({ where: { id: dto.voiceId } });
      if (!m || m.ownerId !== u.id || m.kind !== 'VOICE') throw forbidden('Media not yours');
      transcript = (await this.ai.stt(Buffer.from(m.data), m.mime))?.text;
    }
    const text = [dto.text, transcript].filter(Boolean).join(' ');
    const mod = text ? await this.ai.moderate(text) : null;
    // Burst check: the same customer reviewing 3+ workers within 10 minutes looks fake.
    const burst = await this.prisma.review.count({
      where: { customerId: b.customerId, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
    });
    const flagged = !!mod?.flagged || burst >= 2;
    const flagReason = mod?.flagged ? mod.reason || 'Abusive language' : burst >= 2 ? 'Review burst from one account' : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.review.create({
        data: { bookingId: id, customerId: b.customerId, workerId: b.workerId, ...dto, transcript, flagged, flagReason },
      });
      const agg = await tx.review.aggregate({
        where: { workerId: b.workerId, status: 'PUBLISHED' },
        _avg: { overall: true },
        _count: true,
      });
      await tx.workerProfile.update({
        where: { id: b.workerId },
        data: { ratingAvg: agg._avg.overall ?? 0, ratingCount: agg._count },
      });
    });
    void this.refreshSummary(b.workerId);
    return { ok: true, flagged };
  }

  async refreshSummary(workerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { workerId, status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { text: true, transcript: true, tags: true },
    });
    const texts = reviews.map((r) => [r.text, r.transcript, r.tags.join(', ')].filter(Boolean).join(' ')).filter(Boolean);
    const s = texts.length ? await this.ai.summarize(texts) : null;
    if (s?.summary) await this.prisma.workerProfile.update({ where: { id: workerId }, data: { aiSummary: s.summary } });
  }
}
