import { Body, Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import type { Response } from 'express';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Roles } from '../common/auth';
import { AppError, badRequest } from '../common/errors';
import { AUDIO_MAX, sniffAudio } from '../common/uploads';
import { AiClient } from './ai-client.service';

class DiagnoseDto {
  @IsString()
  @Length(2, 1000)
  text!: string;

  @IsOptional()
  @IsString()
  photoMediaId?: string;
}

class TtsDto {
  @IsString()
  @Length(1, 600)
  text!: string;

  @IsIn(['UR', 'EN', 'ur', 'en'])
  lang!: string;
}

class SessionDto {
  @IsEnum(['WORKER_ONBOARDING', 'CUSTOMER_BOOKING'])
  purpose!: string;
}

class ExtractDto {
  @IsString()
  @Length(2, 4000)
  transcript!: string;
}

@Controller()
export class AiController {
  constructor(
    private ai: AiClient,
    private jwt: JwtService,
  ) {}

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Post('ai/diagnose')
  diagnose(@Body() dto: DiagnoseDto) {
    return this.ai.diagnose(dto.text);
  }

  @Roles('WORKER')
  @Post('ai/extract-profile')
  async extract(@Body() dto: ExtractDto) {
    return (await this.ai.extractProfile(dto.transcript)) ?? {};
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('voice/stt')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: AUDIO_MAX } }))
  async stt(@UploadedFile() file?: Express.Multer.File, @Body('lang') lang?: string) {
    if (!file) throw badRequest('FILE_REQUIRED');
    const r = await this.ai.stt(file.buffer, sniffAudio(file.buffer), lang);
    if (!r) throw new AppError(503, 'AI_UNAVAILABLE', 'Speech service unavailable');
    return r;
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('voice/tts')
  async tts(@Body() dto: TtsDto, @Res() res: Response) {
    const audio = await this.ai.tts(dto.text, dto.lang.toLowerCase());
    if (!audio) throw new AppError(503, 'AI_UNAVAILABLE', 'Voice service unavailable');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(audio);
  }

  /** Short-lived token bound to the user; Vapi passes it back to the webhook. */
  @Roles('CUSTOMER', 'WORKER')
  @Post('voice/session')
  async session(@CurrentUser() u: AuthUser, @Body() dto: SessionDto) {
    const voiceToken = await this.jwt.signAsync(
      { sub: u.id, purpose: dto.purpose },
      { secret: process.env.VOICE_TOKEN_SECRET, expiresIn: '10m' },
    );
    return { voiceToken };
  }
}
