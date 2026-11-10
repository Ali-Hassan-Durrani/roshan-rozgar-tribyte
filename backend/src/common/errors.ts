import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message = code) {
    super({ error: { code, message } }, status);
  }
}

export const conflict = (code: string, msg?: string) => new AppError(HttpStatus.CONFLICT, code, msg);
export const badRequest = (code: string, msg?: string) => new AppError(HttpStatus.BAD_REQUEST, code, msg);
export const forbidden = (msg = 'Forbidden') => new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', msg);
