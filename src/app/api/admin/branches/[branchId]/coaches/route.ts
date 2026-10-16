import { revalidatePath } from "next/cache";
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
  const rawCoachIds: unknown = body.coachIds;
  const coachIds: string[] | null = Array.isArray(rawCoachIds)
    ? Array.from(
        new Set(
          rawCoachIds.filter(
            (value): value is string =>
              typeof value === "string" && Boolean(value.trim())
          ).map((value) => value.trim())
        )
      )
    : null;

  if (!coachIds) {
    return NextResponse.json(
      { ok: false, error: "INVALID_COACH_IDS" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const [branch, coaches, before] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, slug: true }
    }),
    prisma.coach.findMany({
      where: {
        id: { in: coachIds },
        status: { not: LifecycleStatus.ARCHIVED }
      },
      select: { id: true }
    }),
    prisma.coachBranch.findMany({
      where: { branchId },
      orderBy: { coachId: "asc" }
    })
  ]);

  if (!branch) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (coaches.length !== coachIds.length) {
    return NextResponse.json(
      { ok: false, error: "COACH_NOT_FOUND" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.coachBranch.updateMany({
      where: {
        branchId,
        coachId: { notIn: coachIds }
      },
      data: { status: LifecycleStatus.PAUSED }
    });

    for (const coachId of coachIds) {
      await tx.coachBranch.upsert({
        where: {
          coachId_branchId: {
            coachId,
            branchId
          }
        },
        update: { status: LifecycleStatus.ACTIVE },
        create: {
          coachId,
          branchId,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  });

  const after = await prisma.coachBranch.findMany({
    where: { branchId },
    orderBy: { coachId: "asc" }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE_COACHES",
    entityType: "Branch",
    entityId: branchId,
    before,
    after
  });

  revalidatePath("/ru/branches");
  revalidatePath("/uz/branches");
  revalidatePath(`/ru/branches/${branch.slug}`);
  revalidatePath(`/uz/branches/${branch.slug}`);
  revalidatePath("/ru/coaches");
  revalidatePath("/uz/coaches");

  for (const coachId of coachIds) {
    revalidatePath(`/ru/coaches/${coachId}`);
    revalidatePath(`/uz/coaches/${coachId}`);
  }

  return NextResponse.json({
    ok: true,
    activeCoachIds: after
      .filter((item) => item.status === LifecycleStatus.ACTIVE)
      .map((item) => item.coachId)
  });
}
