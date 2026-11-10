import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/** Uniform `{ error: { code, message } }` bodies, no stack traces. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private log = new Logger('Error');

  catch(ex: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (ex instanceof ThrottlerException) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    }
    if (ex instanceof HttpException) {
      const status = ex.getStatus();
      const body = ex.getResponse() as any;
      if (body?.error?.code) return res.status(status).json(body);
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message || ex.message;
      const code =
        status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST';
      return res.status(status).json({ error: { code, message } });
    }
    this.log.error((ex as Error)?.message);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  }
}
