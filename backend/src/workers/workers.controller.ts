import {
  Body, Controller, Get, Param, Patch, Post, Put, Query, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Public, Roles } from '../common/auth';
import { badRequest } from '../common/errors';
import { IMAGE_MAX } from '../common/uploads';
import { AvailabilityDto, ProfileDto, SearchDto } from './dto';
import { WorkersService } from './workers.service';

const imageUpload = { limits: { fileSize: IMAGE_MAX } };

@Controller('workers')
export class WorkersController {
  constructor(private workers: WorkersService) {}

  @Public()
  @Get('search')
  search(@Query() q: SearchDto, @CurrentUser() u?: AuthUser) {
    return this.workers.search(q, u?.id);
  }

  @Roles('WORKER')
  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.workers.me(u.id);
  }

  @Roles('WORKER')
  @Put('me/profile')
  profile(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    return this.workers.saveProfile(u.id, dto);
  }

  @Roles('WORKER')
  @Post('me/photo')
  @UseInterceptors(FileInterceptor('file', imageUpload))
  photo(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw badRequest('FILE_REQUIRED');
    return this.workers.savePhoto(u.id, file, 'PHOTO');
  }

  @Roles('WORKER')
  @Post('me/work-photos')
  @UseInterceptors(FileInterceptor('file', imageUpload))
  workPhoto(@CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw badRequest('FILE_REQUIRED');
    return this.workers.savePhoto(u.id, file, 'WORK_PHOTO');
  }

  @Roles('WORKER')
  @Post('me/cnic')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 },
      ],
      imageUpload,
    ),
  )
  cnic(
    @CurrentUser() u: AuthUser,
    @UploadedFiles() files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] },
  ) {
    if (!files?.front?.[0] || !files?.back?.[0]) throw badRequest('FILE_REQUIRED', 'Front and back are required');
    return this.workers.saveCnic(u.id, files.front[0], files.back[0]);
  }

  @Roles('WORKER')
  @Post('me/submit')
  submit(@CurrentUser() u: AuthUser) {
    return this.workers.submit(u.id);
  }

  @Roles('WORKER')
  @Patch('me/availability')
  availability(@CurrentUser() u: AuthUser, @Body() dto: AvailabilityDto) {
    return this.workers.setAvailability(u.id, dto.availability);
  }

  @Roles('WORKER')
  @Get('me/requests')
  requests(@CurrentUser() u: AuthUser) {
    return this.workers.requests(u.id);
  }

  @Roles('WORKER')
  @Get('me/earnings')
  earnings(@CurrentUser() u: AuthUser) {
    return this.workers.earnings(u.id);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() u?: AuthUser) {
    return this.workers.publicProfile(id, u?.id);
  }
}
