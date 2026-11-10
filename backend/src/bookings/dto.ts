import { Trade } from '@prisma/client';
import {
  ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  workerId!: string;

  @IsEnum(Trade)
  trade!: Trade;

  @IsString()
  @Length(2, 1000)
  problemText!: string;

  @IsOptional()
  @IsString()
  problemVoiceId?: string;

  @IsOptional()
  @IsString()
  problemPhotoId?: string;

  @IsIn(['NOW', 'TODAY', 'SCHEDULED'])
  urgency!: 'NOW' | 'TODAY' | 'SCHEDULED';

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  area?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class DeclineDto {
  @IsIn(['FAR', 'BUSY', 'NOT_MY_WORK', 'LOW_PRICE'])
  reason!: string;
}

export class OfferDto {
  @IsInt()
  @Min(100)
  @Max(100000)
  amount!: number;
}

export class StartDto {
  @Matches(/^\d{4}$/)
  code!: string;
}

export class CancelDto {
  @IsString()
  @Length(2, 200)
  reason!: string;
}

export class MessageDto {
  @IsIn(['TEXT', 'VOICE'])
  type!: 'TEXT' | 'VOICE';

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  text?: string;

  @IsOptional()
  @IsString()
  audioId?: string;
}

export class ReviewDto {
  @IsInt() @Min(1) @Max(5) overall!: number;
  @IsInt() @Min(1) @Max(5) quality!: number;
  @IsInt() @Min(1) @Max(5) onTime!: number;
  @IsInt() @Min(1) @Max(5) fairPrice!: number;
  @IsInt() @Min(1) @Max(5) behaviour!: number;

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(1, 40, { each: true })
  tags!: string[];

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  text?: string;

  @IsOptional()
  @IsString()
  voiceId?: string;
}
