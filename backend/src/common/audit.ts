import { PrismaService } from './prisma.service';

export const audit = (
  prisma: PrismaService,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  meta?: object,
) => prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta as any } });
