import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { AiClient } from './ai/ai-client.service';
import { AiController } from './ai/ai.controller';
import { VapiController } from './ai/vapi.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SmsService } from './auth/sms.service';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { AuthGuard, Public } from './common/auth';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { PrismaModule } from './common/prisma.service';
import { CustomersController } from './customers/customers.controller';
import { MediaController } from './media/media.controller';
import { WorkersController } from './workers/workers.controller';
import { WorkersService } from './workers/workers.service';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'backend' };
  }
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
  ],
  controllers: [
    HealthController,
    AuthController,
    CustomersController,
    WorkersController,
    BookingsController,
    MediaController,
    AiController,
    VapiController,
    AdminController,
  ],
  providers: [
    AuthService,
    SmsService,
    AiClient,
    WorkersService,
    BookingsService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
