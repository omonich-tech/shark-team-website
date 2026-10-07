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
  const rawIds: unknown = body.branchIds;
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
    prisma.branch.findMany({
      where: {
        id: { in: ids },
        status: { not: LifecycleStatus.ARCHIVED }
      },
      select: { id: true }
    }),
    prisma.coachBranch.findMany({
      where: { coachId },
      orderBy: { branchId: "asc" }
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
    await tx.coachBranch.updateMany({
      where: {
        coachId,
        branchId: { notIn: ids }
      },
      data: { status: LifecycleStatus.PAUSED }
    });

    for (const targetId of ids) {
      await tx.coachBranch.upsert({
        where: {
          coachId_branchId: {
            coachId,
            branchId: targetId
          }
        },
        update: { status: LifecycleStatus.ACTIVE },
        create: {
          coachId,
          branchId: targetId,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  });

  const after = await prisma.coachBranch.findMany({
    where: { coachId },
    orderBy: { branchId: "asc" }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE_BRANCHS",
    entityType: "Coach",
    entityId: coachId,
    before,
    after
  });

  return NextResponse.json({
    ok: true,
    activeIds: after
      .filter((item) => item.status === LifecycleStatus.ACTIVE)
      .map((item) => item.branchId)
  });
}
