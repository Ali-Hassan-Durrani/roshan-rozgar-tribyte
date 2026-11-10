import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Roles } from '../common/auth';
import { BookingsService } from './bookings.service';
import { CancelDto, CreateBookingDto, DeclineDto, MessageDto, OfferDto, ReviewDto, StartDto } from './dto';

@Controller('bookings')
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(u, dto);
  }

  @Roles('CUSTOMER', 'WORKER')
  @Get()
  list(@CurrentUser() u: AuthUser, @Query('status') status?: string) {
    return this.bookings.list(u, status);
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.bookings.get(u, id);
  }

  @Roles('WORKER')
  @Post(':id/accept')
  accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.bookings.accept(u, id);
  }

  @Roles('WORKER')
  @Post(':id/decline')
  decline(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DeclineDto) {
    return this.bookings.decline(u, id, dto.reason);
  }

  @Roles('CUSTOMER', 'WORKER')
  @Post(':id/offers')
  offer(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: OfferDto) {
    return this.bookings.offer(u, id, dto.amount);
  }

  @Roles('CUSTOMER', 'WORKER')
  @Post(':id/offers/:offerId/accept')
  acceptOffer(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('offerId') offerId: string) {
    return this.bookings.acceptOffer(u, id, offerId);
  }

  @Roles('WORKER')
  @Post(':id/start')
  start(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: StartDto) {
    return this.bookings.start(u, id, dto.code);
  }

  @Roles('WORKER')
  @Post(':id/complete')
  complete(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.bookings.complete(u, id);
  }

  @Roles('CUSTOMER', 'WORKER')
  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.bookings.cancel(u, id, dto.reason);
  }

  @Roles('CUSTOMER', 'WORKER', 'ADMIN')
  @Get(':id/messages')
  messages(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('after') after?: string) {
    return this.bookings.messages(u, id, after);
  }

  @Roles('CUSTOMER', 'WORKER')
  @Post(':id/messages')
  send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.bookings.sendMessage(u, id, dto);
  }

  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 5, ttl: 3600_000 } })
  @Post(':id/review')
  review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.bookings.review(u, id, dto);
  }
}
