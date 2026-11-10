import { Injectable, Logger } from '@nestjs/common';
import { Trade } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/** Default fair-price ranges (PKR) when there is too little booking history. */
export const DEFAULT_PRICE: Record<Trade, [number, number]> = {
  ELECTRICIAN: [600, 1200],
  PLUMBER: [600, 1500],
  AC_TECHNICIAN: [1500, 3500],
  CARPENTER: [800, 2000],
  MECHANIC: [1000, 3000],
  PAINTER: [2000, 6000],
};

const KEYWORDS: [Trade, string[]][] = [
  ['AC_TECHNICIAN', ['ac', 'a/c', 'air condition', 'thanda', 'cooling', 'gas', 'split', 'inverter', 'اے سی', 'ٹھنڈ', 'گیس']],
  ['PLUMBER', ['nalka', 'leak', 'paani', 'pani', 'pipe', 'tap', 'drain', 'flush', 'geyser', 'tanki', 'water', 'نلکا', 'پانی', 'پائپ', 'لیک']],
  ['ELECTRICIAN', ['bijli', 'switch', 'pankha', 'fan', 'wire', 'light', 'socket', 'breaker', 'ups', 'short', 'بجلی', 'پنکھا', 'سوئچ', 'تار']],
  ['CARPENTER', ['door', 'darwaza', 'lakri', 'wood', 'cupboard', 'almari', 'furniture', 'table', 'hinge', 'دروازہ', 'لکڑی', 'الماری']],
  ['MECHANIC', ['car', 'gaari', 'gari', 'bike', 'engine', 'motor', 'tyre', 'battery', 'گاڑی', 'انجن', 'موٹر']],
  ['PAINTER', ['paint', 'rang', 'color', 'colour', 'wall', 'deewar', 'diwar', 'رنگ', 'دیوار', 'پینٹ']],
];

export function keywordDiagnose(text: string) {
  const t = text.toLowerCase();
  let best: { trade: Trade; hits: number } = { trade: 'ELECTRICIAN', hits: 0 };
  for (const [trade, words] of KEYWORDS) {
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits > best.hits) best = { trade, hits };
  }
  return { trade: best.trade, issue: text.slice(0, 120), confidence: best.hits ? Math.min(0.55 + best.hits * 0.15, 0.95) : 0.3 };
}

@Injectable()
export class AiClient {
  private log = new Logger('AI');

  constructor(private prisma: PrismaService) {}

  private async call<T>(path: string, body: unknown, form = false): Promise<T | null> {
    const url = process.env.AI_SERVICE_URL;
    if (!url) return null;
    try {
      const res = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: {
          'X-Internal-Key': process.env.AI_INTERNAL_KEY || '',
          ...(form ? {} : { 'Content-Type': 'application/json' }),
        },
        body: form ? (body as FormData) : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        this.log.warn(`${path} → ${res.status}`);
        return null;
      }
      const type = res.headers.get('content-type') || '';
      return (type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())) as T;
    } catch (e) {
      this.log.warn(`${path} failed: ${(e as Error).message}`);
      return null;
    }
  }

  async diagnose(text: string) {
    const ai = await this.call<{ trade: Trade; issue: string; confidence: number }>('/diagnose', { text });
    const d = ai?.trade ? ai : keywordDiagnose(text);
    return { ...d, ...(await this.price(d.trade)) };
  }

  /** Fair range = p25–p75 of completed bookings for the trade in the last 90 days. */
  async price(trade: Trade, area?: string) {
    const since = new Date(Date.now() - 90 * 24 * 3600_000);
    const rows = await this.prisma.booking.findMany({
      where: { trade, status: 'COMPLETED', agreedPrice: { not: null }, completedAt: { gt: since }, ...(area ? { area } : {}) },
      select: { agreedPrice: true },
    });
    const prices = rows.map((r) => r.agreedPrice!).sort((a, b) => a - b);
    if (prices.length < 5) {
      if (area) return this.price(trade);
      const [priceMin, priceMax] = DEFAULT_PRICE[trade];
      return { priceMin, priceMax, basis: 'default' };
    }
    const q = (p: number) => prices[Math.floor(p * (prices.length - 1))];
    const round = (n: number) => Math.round(n / 50) * 50;
    return { priceMin: round(q(0.25)), priceMax: round(q(0.75)), basis: `${prices.length} recent jobs` };
  }

  stt(audio: Buffer, mime: string, lang?: string) {
    const fd = new FormData();
    fd.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), 'audio');
    if (lang) fd.append('lang', lang);
    return this.call<{ text: string; language: string }>('/stt', fd, true);
  }

  tts(text: string, lang: string) {
    return this.call<Buffer>('/tts', { text, lang });
  }

  extractProfile(transcript: string) {
    return this.call<Record<string, unknown>>('/extract/profile', { transcript });
  }

  moderate(text: string) {
    return this.call<{ flagged: boolean; reason?: string }>('/moderate/review', { text });
  }

  summarize(reviews: string[]) {
    return this.call<{ summary: string; tags: string[] }>('/summary/reviews', { reviews });
  }

  translate(text: string, to: string) {
    return this.call<{ text: string }>('/translate', { text, to });
  }

  ocrCnic(front: Buffer, back: Buffer) {
    const fd = new FormData();
    fd.append('front', new Blob([new Uint8Array(front)]), 'front.jpg');
    fd.append('back', new Blob([new Uint8Array(back)]), 'back.jpg');
    return this.call<{
      cnicNumber?: string;
      name?: string;
      fatherName?: string;
      dob?: string;
      expiry?: string;
      confidence: number;
      blurScore: number;
      backCnicNumber?: string;
    }>('/ocr/cnic', fd, true);
  }
}
