import 'dotenv/config';
import { BookingStatus, PrismaClient, Trade } from '@prisma/client';

const prisma = new PrismaClient();

const SECTORS: Record<string, [number, number]> = {
  'G-9': [33.6938, 73.0313],
  'G-10': [33.6845, 73.0136],
  'G-11': [33.668, 72.9958],
  'F-10': [33.695, 73.013],
  'I-8': [33.667, 73.075],
  Saddar: [33.5973, 73.0479],
};
const jitter = () => (Math.random() - 0.5) * 0.012;

// [name, trade, years, rate, rating, sector, availability, status]
const WORKERS: [string, Trade, number, number, number, string, 'AVAILABLE' | 'BUSY' | 'OFFLINE', string][] = [
  ['Imran Khan', 'ELECTRICIAN', 12, 800, 4.8, 'G-10', 'AVAILABLE', 'VERIFIED'],
  ['Bilal Ahmed', 'AC_TECHNICIAN', 8, 2000, 4.9, 'G-10', 'AVAILABLE', 'VERIFIED'],
  ['Shakeel Abbasi', 'PLUMBER', 10, 900, 4.7, 'G-9', 'AVAILABLE', 'VERIFIED'],
  ['Naveed Iqbal', 'CARPENTER', 15, 1200, 4.6, 'G-11', 'AVAILABLE', 'VERIFIED'],
  ['Usman Tariq', 'ELECTRICIAN', 6, 700, 4.5, 'G-9', 'AVAILABLE', 'VERIFIED'],
  ['Kamran Ali', 'PLUMBER', 7, 800, 4.4, 'F-10', 'AVAILABLE', 'VERIFIED'],
  ['Faisal Mehmood', 'ELECTRICIAN', 9, 900, 4.6, 'G-10', 'BUSY', 'VERIFIED'],
  ['Tariq Jameel', 'AC_TECHNICIAN', 11, 2500, 4.7, 'F-10', 'AVAILABLE', 'VERIFIED'],
  ['Zubair Hussain', 'MECHANIC', 13, 1500, 4.5, 'I-8', 'AVAILABLE', 'VERIFIED'],
  ['Sajid Mahmood', 'PAINTER', 9, 3000, 4.3, 'Saddar', 'AVAILABLE', 'VERIFIED'],
  ['Arshad Nadeem', 'CARPENTER', 5, 1000, 4.2, 'I-8', 'AVAILABLE', 'VERIFIED'],
  ['Waqas Anwar', 'MECHANIC', 4, 1200, 4.1, 'Saddar', 'OFFLINE', 'VERIFIED'],
  ['Hamza Yousaf', 'PAINTER', 6, 2500, 4.4, 'G-11', 'AVAILABLE', 'VERIFIED'],
  ['Adeel Raza', 'AC_TECHNICIAN', 3, 1800, 4.0, 'G-9', 'AVAILABLE', 'VERIFIED'],
  ['Shahid Afridi', 'PLUMBER', 14, 1000, 4.8, 'G-11', 'AVAILABLE', 'VERIFIED'],
  ['Javed Akhtar', 'ELECTRICIAN', 20, 1000, 4.9, 'F-10', 'AVAILABLE', 'VERIFIED'],
  ['Nadeem Abbas', 'MECHANIC', 8, 1400, 4.3, 'G-10', 'AVAILABLE', 'VERIFIED'],
  ['Rashid Latif', 'CARPENTER', 10, 1100, 4.5, 'Saddar', 'BUSY', 'VERIFIED'],
  ['Asif Mehmood', 'PLUMBER', 5, 800, 0, 'G-10', 'OFFLINE', 'PENDING_REVIEW'],
  ['Rizwan Shah', 'ELECTRICIAN', 4, 700, 0, 'G-9', 'OFFLINE', 'PENDING_REVIEW'],
];

const CUSTOMERS: [string, string, string, string][] = [
  ['923000000001', 'Sara Ahmed', 'House 12, Street 5', 'G-10'],
  ['923000000011', 'Ali Raza', 'House 40, Street 18', 'G-10'],
  ['923000000012', 'Hina Malik', 'House 7, Street 2', 'G-11'],
];

const PRICE: Record<Trade, [number, number]> = {
  ELECTRICIAN: [600, 1200],
  PLUMBER: [600, 1500],
  AC_TECHNICIAN: [1500, 3500],
  CARPENTER: [800, 2000],
  MECHANIC: [1000, 3000],
  PAINTER: [2000, 6000],
};
const PROBLEMS: Record<Trade, string[]> = {
  ELECTRICIAN: ['Ceiling fan not working', 'Switch board sparking', 'UPS wiring', 'Light fitting'],
  PLUMBER: ['Kitchen tap leaking', 'Bathroom drain blocked', 'Geyser pipe leak', 'Flush not working'],
  AC_TECHNICIAN: ['AC not cooling', 'AC gas refill', 'Split AC service', 'AC water leaking'],
  CARPENTER: ['Door hinge broken', 'Cupboard lock repair', 'Bed frame fix', 'New shelf'],
  MECHANIC: ['Car battery dead', 'Bike engine noise', 'Car AC check', 'Oil change'],
  PAINTER: ['One room paint', 'Wall seepage paint', 'Gate paint', 'Kitchen paint'],
};
const TAGS = ['On time', 'Clean work', 'Fair price', 'Polite', 'Expert', 'Explained the problem'];
const TEXTS = [
  'Bohat acha kaam kiya, time pe aaye.',
  'Very professional and clean work.',
  'Kaam theek tha, price bhi munasib.',
  'Quick fix, highly recommended.',
  'Good behaviour, explained everything.',
];

const rnd = (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1));
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const phoneFor = (i: number) => `9230010000${String(i).padStart(2, '0')}`;

async function main() {
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.priceOffer.deleteMany(),
    prisma.review.deleteMany(),
    prisma.workerProfile.updateMany({ data: { activeBookingId: null } }),
    prisma.booking.deleteMany(),
    prisma.cnic.deleteMany(),
    prisma.media.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.otpChallenge.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.workerProfile.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.user.create({ data: { phone: '923000000003', role: 'ADMIN', name: 'Admin' } });

  const customers = [];
  for (const [phone, name, address, area] of CUSTOMERS) {
    const [lat, lng] = SECTORS[area];
    const u = await prisma.user.create({
      data: { phone, role: 'CUSTOMER', name, customer: { create: { address, area, lat, lng } } },
      include: { customer: true },
    });
    customers.push(u.customer!);
  }

  const workers = [];
  for (const [i, [name, trade, years, rate, rating, sector, availability, status]] of WORKERS.entries()) {
    const [lat, lng] = SECTORS[sector];
    // Demo worker 03000000002 = Imran Khan.
    const phone = i === 0 ? '923000000002' : phoneFor(i);
    const u = await prisma.user.create({
      data: {
        phone,
        role: 'WORKER',
        name,
        lang: 'UR',
        worker: {
          create: {
            status: status as any,
            availability,
            trade,
            experienceYears: years,
            areas: [sector],
            baseRate: rate,
            workHours: '9am - 7pm',
            lat: lat + jitter(),
            lng: lng + jitter(),
            ratingAvg: rating,
          },
        },
      },
      include: { worker: true },
    });
    workers.push(u.worker!);
  }

  // ~80 completed past bookings + ~60 reviews (fair-price history and ratings).
  const verified = workers.filter((w) => w.status === 'VERIFIED');
  let n = 1000;
  for (let i = 0; i < 80; i++) {
    const w = verified[i % verified.length];
    const c = pick(customers);
    const [lo, hi] = PRICE[w.trade!];
    const daysAgo = rnd(1, 80);
    const at = new Date(Date.now() - daysAgo * 24 * 3600_000);
    const b = await prisma.booking.create({
      data: {
        code: `RR-${n++}`,
        customerId: c.id,
        workerId: w.id,
        trade: w.trade!,
        problemText: pick(PROBLEMS[w.trade!]),
        urgency: 'TODAY',
        address: c.address!,
        area: c.area!,
        lat: c.lat,
        lng: c.lng,
        aiPriceMin: lo,
        aiPriceMax: hi,
        agreedPrice: Math.round(rnd(lo, hi) / 50) * 50,
        status: BookingStatus.COMPLETED,
        createdAt: at,
        startedAt: at,
        completedAt: new Date(at.getTime() + 2 * 3600_000),
      },
    });
    if (i < 60) {
      const base = Math.round(w.ratingAvg);
      const s = () => Math.max(3, Math.min(5, base + rnd(-1, 0)));
      await prisma.review.create({
        data: {
          bookingId: b.id,
          customerId: c.id,
          workerId: w.id,
          overall: s(),
          quality: s(),
          onTime: s(),
          fairPrice: s(),
          behaviour: s(),
          tags: [pick(TAGS), pick(TAGS)].filter((t, k, a) => a.indexOf(t) === k),
          text: pick(TEXTS),
          createdAt: new Date(at.getTime() + 3 * 3600_000),
        },
      });
    }
  }

  // Over-priced booking (Rs 6,000 for a fan repair) — shows up against the AI fair range.
  const imran = workers[0];
  const sara = customers[0];
  await prisma.booking.create({
    data: {
      code: `RR-${n++}`, customerId: customers[2].id, workerId: workers[4].id, trade: 'ELECTRICIAN',
      problemText: 'Ceiling fan repair', urgency: 'TODAY', address: customers[2].address!, area: customers[2].area!,
      aiPriceMin: 600, aiPriceMax: 1200, agreedPrice: 6000, status: 'COMPLETED',
      completedAt: new Date(Date.now() - 2 * 24 * 3600_000),
    },
  });

  // Flagged set: same customer, 3 five-star reviews within 10 minutes.
  const burstAt = Date.now() - 3600_000;
  for (const [k, w] of [workers[5], workers[10], workers[13]].entries()) {
    const b = await prisma.booking.create({
      data: {
        code: `RR-${n++}`, customerId: customers[1].id, workerId: w.id, trade: w.trade!, problemText: 'Small job',
        urgency: 'NOW', address: customers[1].address!, area: customers[1].area!, agreedPrice: 500, status: 'COMPLETED',
        completedAt: new Date(burstAt - 3600_000),
      },
    });
    await prisma.review.create({
      data: {
        bookingId: b.id, customerId: customers[1].id, workerId: w.id, overall: 5, quality: 5, onTime: 5, fairPrice: 5,
        behaviour: 5, tags: ['Expert'], text: 'Best worker ever!!!', flagged: true,
        flagReason: 'Review burst from one account', createdAt: new Date(burstAt + k * 3 * 60_000),
      },
    });
  }

  // Abusive voice review (transcript) — flagged by moderation.
  const ab = await prisma.booking.create({
    data: {
      code: `RR-${n++}`, customerId: sara.id, workerId: workers[2].id, trade: 'PLUMBER', problemText: 'Tap leaking',
      urgency: 'TODAY', address: sara.address!, area: sara.area!, agreedPrice: 900, status: 'COMPLETED',
      completedAt: new Date(Date.now() - 5 * 3600_000),
    },
  });
  await prisma.review.create({
    data: {
      bookingId: ab.id, customerId: sara.id, workerId: workers[2].id, overall: 1, quality: 1, onTime: 2, fairPrice: 1,
      behaviour: 1, tags: [], transcript: 'Bilkul bekaar banda, ullu ka pattha, kabhi mat bulana', flagged: true,
      flagReason: 'Abusive language (voice review)',
    },
  });

  // Busy workers hold one active (CONFIRMED / IN_PROGRESS) job each.
  for (const w of workers.filter((x) => x.availability === 'BUSY')) {
    const c = customers[1];
    const b = await prisma.booking.create({
      data: {
        code: `RR-${n++}`, customerId: c.id, workerId: w.id, trade: w.trade!, problemText: pick(PROBLEMS[w.trade!]),
        urgency: 'NOW', address: c.address!, area: c.area!, lat: c.lat, lng: c.lng, agreedPrice: w.baseRate,
        status: 'IN_PROGRESS', startedAt: new Date(Date.now() - 40 * 60_000),
      },
    });
    await prisma.workerProfile.update({ where: { id: w.id }, data: { activeBookingId: b.id } });
  }

  // Recompute rating aggregates + a simple AI summary per worker.
  for (const w of verified) {
    const agg = await prisma.review.aggregate({
      where: { workerId: w.id, status: 'PUBLISHED', flagged: false },
      _avg: { overall: true },
      _count: true,
    });
    const jobs = await prisma.booking.count({ where: { workerId: w.id, status: 'COMPLETED' } });
    await prisma.workerProfile.update({
      where: { id: w.id },
      data: {
        ratingAvg: agg._count ? Math.max(agg._avg.overall ?? 0, w.ratingAvg - 0.2) : w.ratingAvg,
        ratingCount: agg._count,
        jobsDone: jobs + rnd(20, 120),
        aiSummary: `Customers say ${w.experienceYears}+ years of experience shows: on time, clean work and fair prices. Most mentioned: ${pick(TAGS).toLowerCase()} and ${pick(TAGS).toLowerCase()}.`,
      },
    });
  }
  // Keep the headline ratings from the designs.
  await prisma.workerProfile.update({ where: { id: imran.id }, data: { ratingAvg: 4.8 } });

  console.log(`Seeded: 1 admin, ${customers.length} customers, ${workers.length} workers, ${n - 1000} bookings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
