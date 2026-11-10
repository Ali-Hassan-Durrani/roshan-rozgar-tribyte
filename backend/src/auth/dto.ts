import { IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Lang } from '@prisma/client';

const PHONE = /^(?:\+92|0092|92|0)?3\d{9}$/;

export class OtpRequestDto {
  @Matches(PHONE, { message: 'Enter a valid Pakistani mobile number' })
  phone!: string;
}

export class OtpVerifyDto {
  @Matches(PHONE)
  phone!: string;

  @Matches(/^\d{4}$/)
  code!: string;

  // ADMIN is never accepted from the client.
  @IsOptional()
  @IsIn(['CUSTOMER', 'WORKER'])
  role?: 'CUSTOMER' | 'WORKER';
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @IsOptional()
  @IsEnum(Lang)
  lang?: Lang;
}
