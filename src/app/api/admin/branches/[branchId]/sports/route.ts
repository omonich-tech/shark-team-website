import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ branchId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { branchId } = await context.params;
  const body = await request.json();
  const rawSportIds: unknown = body.sportIds;
  const sportIds: string[] | null = Array.isArray(rawSportIds)
    ? Array.from(
        new Set<string>(
          rawSportIds.reduce<string[]>((items, value: unknown) => {
            if (typeof value === "string" && value.trim()) {
              items.push(value.trim());
            }
            return items;
          }, [])
        )
      )
    : null;

  if (!sportIds) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SPORT_IDS" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const [branch, sports, before] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
    prisma.sport.findMany({
      where: {
        id: { in: sportIds },
        status: { not: LifecycleStatus.ARCHIVED }
      },
      select: { id: true }
    }),
    prisma.branchSport.findMany({
      where: { branchId },
      orderBy: { sportId: "asc" }
    })
  ]);

  if (!branch) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (sports.length !== sportIds.length) {
    return NextResponse.json(
      { ok: false, error: "SPORT_NOT_FOUND" },
      { status: 400 }
    );
  }


  await prisma.$transaction(async (tx) => {
    await tx.branchSport.updateMany({
      where: {
        branchId,
        sportId: { notIn: sportIds }
      },
      data: { status: LifecycleStatus.PAUSED }
    });

    for (const sportId of sportIds) {
      await tx.branchSport.upsert({
        where: {
          branchId_sportId: {
            branchId,
            sportId
          }
        },
        update: {
          status: LifecycleStatus.ACTIVE
        },
        create: {
          branchId,
          sportId,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  });

  const after = await prisma.branchSport.findMany({
    where: { branchId },
    orderBy: { sportId: "asc" }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE_SPORTS",
    entityType: "Branch",
    entityId: branchId,
    before,
    after
  });

  return NextResponse.json({
    ok: true,
    activeSportIds: after
      .filter((item) => item.status === LifecycleStatus.ACTIVE)
      .map((item) => item.sportId)
  });
}
