import {
  Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaKind } from '@prisma/client';
import { IsEnum } from 'class-validator';
import type { Response } from 'express';
import { audit } from '../common/audit';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Roles } from '../common/auth';
import { badRequest, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AUDIO_MAX, IMAGE_MAX, sniffAudio, sniffImage } from '../common/uploads';

class UploadDto {
  @IsEnum(['VOICE', 'PROBLEM_PHOTO'])
  kind!: 'VOICE' | 'PROBLEM_PHOTO';
}

@Controller('media')
export class MediaController {
  constructor(private prisma: PrismaService) {}

  /** Generic upload for voice notes and problem photos (profile/CNIC have dedicated routes). */
  @Roles('CUSTOMER', 'WORKER')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_MAX } }))
  async upload(@CurrentUser() u: AuthUser, @Body() dto: UploadDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw badRequest('FILE_REQUIRED');
    const isVoice = dto.kind === 'VOICE';
    if (isVoice && file.size > AUDIO_MAX) throw badRequest('FILE_TOO_LARGE');
    const mime = isVoice ? sniffAudio(file.buffer) : sniffImage(file.buffer);
    const m = await this.prisma.media.create({
      data: { ownerId: u.id, kind: dto.kind as MediaKind, mime, size: file.size, data: new Uint8Array(file.buffer) },
      select: { id: true, kind: true, mime: true },
    });
    return m;
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Get(':id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const m = await this.prisma.media.findUnique({ where: { id } });
    if (!m) throw notFound();
    await this.assertAccess(u, m);
    res.setHeader('Content-Type', m.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', m.kind.startsWith('CNIC') ? 'private, no-store' : 'private, max-age=300');
    res.send(Buffer.from(m.data));
  }

  private async assertAccess(u: AuthUser, m: { id: string; ownerId: string; kind: MediaKind }) {
    if (m.ownerId === u.id) return;
    if (m.kind === 'CNIC_FRONT' || m.kind === 'CNIC_BACK') {
      if (u.role !== 'ADMIN') throw forbidden();
      await audit(this.prisma, u.id, 'VIEW_CNIC_IMAGE', 'Media', m.id);
      return;
    }
    if (u.role === 'ADMIN') return;
    if (m.kind === 'PHOTO' || m.kind === 'WORK_PHOTO') {
      const owner = await this.prisma.workerProfile.findUnique({ where: { userId: m.ownerId } });
      if (owner?.status === 'VERIFIED') return;
      throw forbidden();
    }
    // VOICE / PROBLEM_PHOTO → parties of a booking that references it.
    const linked = await this.prisma.booking.findFirst({
      where: {
        OR: [{ customer: { userId: u.id } }, { worker: { userId: u.id } }],
        AND: [
          {
            OR: [
              { problemVoiceId: m.id },
              { problemPhotoId: m.id },
              { messages: { some: { audioId: m.id } } },
              { review: { voiceId: m.id } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    if (!linked) throw forbidden();
  }
}
