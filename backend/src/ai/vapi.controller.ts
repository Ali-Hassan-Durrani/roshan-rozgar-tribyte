import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Trade } from '@prisma/client';
import { Public } from '../common/auth';
import { safeEqual } from '../common/crypto';
import { sectorPoint } from '../common/geo';
import { PrismaService } from '../common/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { AiClient } from './ai-client.service';

const TRADES = Object.values(Trade) as string[];
const seen = new Map<string, unknown>();

/** Vapi tool-call webhook. Auth = shared secret + the signed voice token (never a userId from the call). */
@Controller('vapi')
export class VapiController {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private workers: WorkersService,
    private ai: AiClient,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers('x-vapi-secret') secret: string, @Body() body: any) {
    const expected = process.env.VAPI_WEBHOOK_SECRET;
    if (!expected || !secret || !safeEqual(secret, expected)) throw new UnauthorizedException();

    const msg = body?.message;
    if (msg?.type !== 'tool-calls') return { ok: true };
    const call = msg.call ?? {};
    const token =
      call.assistantOverrides?.variableValues?.voiceToken ?? call.metadata?.voiceToken ?? msg.assistant?.variableValues?.voiceToken;
    let userId: string;
    try {
      userId = (await this.jwt.verifyAsync(token, { secret: process.env.VOICE_TOKEN_SECRET })).sub;
    } catch {
      throw new UnauthorizedException();
    }

    const results: { toolCallId: string; result: unknown }[] = [];
    for (const tc of msg.toolCallList ?? msg.toolCalls ?? []) {
      if (seen.has(tc.id)) {
        results.push({ toolCallId: tc.id, result: seen.get(tc.id) });
        continue;
      }
      const name = tc.function?.name ?? tc.name;
      let args = tc.function?.arguments ?? tc.arguments ?? {};
      if (typeof args === 'string') args = JSON.parse(args);
      const result = await this.run(userId, name, args).catch((e) => `error: ${(e as Error).message}`);
      seen.set(tc.id, result);
      results.push({ toolCallId: tc.id, result });
    }
    return { results };
  }

  private async run(userId: string, name: string, a: any) {
    if (name === 'save_worker_profile') {
      const trade = String(a.trade || '').toUpperCase();
      if (!TRADES.includes(trade)) return 'invalid trade';
      const areas = (Array.isArray(a.areas) ? a.areas : [a.areas]).filter(Boolean).slice(0, 5).map(String);
      const dto = {
        name: String(a.name || '').slice(0, 60),
        trade: trade as Trade,
        experienceYears: Math.max(0, Math.min(60, Math.round(Number(a.experience_years) || 0))),
        areas: areas.length ? areas : ['G-10'],
        baseRate: Math.max(100, Math.min(50000, Math.round(Number(a.base_rate) || 800))),
        workHours: String(a.work_hours || '').slice(0, 80),
      };
      if (dto.name.length < 2) return 'name missing';
      await this.workers.saveProfile(userId, dto);
      return 'saved';
    }
    if (name === 'find_workers') {
      const trade = TRADES.includes(String(a.trade).toUpperCase()) ? (String(a.trade).toUpperCase() as Trade) : undefined;
      const p = sectorPoint(a.area);
      const price = trade ? await this.ai.price(trade) : null;
      const r = await this.workers.search({ trade, availableNow: true, lat: p?.[0], lng: p?.[1] }, userId);
      return JSON.stringify({
        trade,
        priceRange: price && `Rs ${price.priceMin}-${price.priceMax}`,
        top3: r.workers.slice(0, 3).map((w) => ({ name: w.name, rating: w.ratingAvg, distanceKm: w.distanceKm, rate: w.baseRate })),
      });
    }
    return 'unknown tool';
  }
}
