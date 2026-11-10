import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { AuthUser } from '../common/auth';
import { CurrentUser, Roles } from '../common/auth';
import { sectorPoint } from '../common/geo';
import { PrismaService } from '../common/prisma.service';

class UpdateCustomerDto {
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
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

@Roles('CUSTOMER')
@Controller('customers/me')
export class CustomersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.prisma.customerProfile.findUniqueOrThrow({
      where: { userId: u.id },
      include: { user: { select: { name: true, phone: true, lang: true } } },
    });
  }

  @Patch()
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateCustomerDto) {
    const p = dto.lat == null ? sectorPoint(dto.area) : undefined;
    return this.prisma.customerProfile.update({
      where: { userId: u.id },
      data: { ...dto, ...(p ? { lat: p[0], lng: p[1] } : {}) },
    });
  }
}
