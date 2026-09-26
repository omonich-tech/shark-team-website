import {
  AuditActorType,
  Prisma
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAdminAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  const prisma = getPrisma();

  return prisma.auditLog.create({
    data: {
      actorType: AuditActorType.ADMIN,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeJson: jsonValue(input.before),
      afterJson: jsonValue(input.after)
    }
  });
}
