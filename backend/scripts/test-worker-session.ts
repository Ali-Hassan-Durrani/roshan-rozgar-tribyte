// Dev-only helper: creates (or reuses) an onboarding worker and prints a session cookie for it,
// so CNIC/onboarding can be tested without sending a real SMS. Never run against production.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('dev only');
  const prisma = new PrismaClient();
  const phone = '923009999901';
  await prisma.cnic.deleteMany({ where: { worker: { user: { phone } } } });
  const user = await prisma.user.upsert({
    where: { phone },
    update: { worker: { update: { status: 'ONBOARDING' } } },
    create: {
      phone,
      role: 'WORKER',
      name: process.argv[2] || 'Ali Raza',
      worker: { create: { trade: 'PLUMBER', experienceYears: 5, areas: ['G-10'], baseRate: 900 } },
    },
  });
  const token = await new JwtService().signAsync(
    { sub: user.id, role: user.role, phone: user.phone },
    { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
  );
  console.log(`rr_at=${token}`);
  await prisma.$disconnect();
}
main();
