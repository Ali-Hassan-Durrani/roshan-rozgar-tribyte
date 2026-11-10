import { Trade } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min,
} from 'class-validator';

export class ProfileDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsEnum(Trade)
  trade!: Trade;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @Length(2, 40, { each: true })
  areas!: string[];

  @IsInt()
  @Min(100)
  @Max(50000)
  baseRate!: number;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  workHours?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  voiceTranscript?: string;
}

export class AvailabilityDto {
  @IsIn(['AVAILABLE', 'OFFLINE'])
  availability!: 'AVAILABLE' | 'OFFLINE';
}

export class SearchDto {
  @IsOptional()
  @IsEnum(Trade)
  trade?: Trade;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  availableNow?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsIn(['best', 'distance', 'price'])
  sort?: 'best' | 'distance' | 'price';

  @IsOptional()
  @IsString()
  @Length(1, 40)
  area?: string;
}
