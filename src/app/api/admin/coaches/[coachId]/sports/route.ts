import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ coachId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { coachId } = await context.params;
  const body = await request.json();
  const rawIds: unknown = body.sportIds;
  const ids: string[] | null = Array.isArray(rawIds)
    ? Array.from(
        new Set<string>(
          rawIds.reduce<string[]>((items, value: unknown) => {
            if (typeof value === "string" && value.trim()) {
              items.push(value.trim());
            }
            return items;
          }, [])
        )
      )
    : null;

  if (!ids) {
    return NextResponse.json(
      { ok: false, error: "INVALID_RELATION_IDS" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const [coach, targets, before] = await Promise.all([
    prisma.coach.findUnique({ where: { id: coachId }, select: { id: true } }),
    prisma.sport.findMany({
      where: {
        id: { in: ids },
        status: { not: LifecycleStatus.ARCHIVED }
      },
      select: { id: true }
    }),
    prisma.coachSport.findMany({
      where: { coachId },
      orderBy: { sportId: "asc" }
    })
  ]);

  if (!coach) {
    return NextResponse.json(
      { ok: false, error: "COACH_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (targets.length !== ids.length) {
    return NextResponse.json(
      { ok: false, error: "RELATION_TARGET_NOT_FOUND" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.coachSport.updateMany({
      where: {
        coachId,
        sportId: { notIn: ids }
      },
      data: { status: LifecycleStatus.PAUSED }
    });

    for (const targetId of ids) {
      await tx.coachSport.upsert({
        where: {
          coachId_sportId: {
            coachId,
            sportId: targetId
          }
        },
        update: { status: LifecycleStatus.ACTIVE },
        create: {
          coachId,
          sportId: targetId,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  });

  const after = await prisma.coachSport.findMany({
    where: { coachId },
    orderBy: { sportId: "asc" }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE_SPORTS",
    entityType: "Coach",
    entityId: coachId,
    before,
    after
  });

  return NextResponse.json({
    ok: true,
    activeIds: after
      .filter((item) => item.status === LifecycleStatus.ACTIVE)
      .map((item) => item.sportId)
  });
}
