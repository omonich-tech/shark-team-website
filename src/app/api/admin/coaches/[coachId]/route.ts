import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { countActiveGroups } from "@/server/admin/relation-integrity";

function optionalString(value: unknown, max = 1000) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function PATCH(
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
  const prisma = getPrisma();

  const before = await prisma.coach.findUnique({
    where: { id: coachId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "COACH_NOT_FOUND" },
      { status: 404 }
    );
  }

  // Status-only actions must not require resubmitting the full coach profile.
  // This preserves the existing CoachAccount, assignments, and profile details.
  if (body.action === "SET_STATUS") {
    const status = String(body.status ?? "") as LifecycleStatus;
    if (status !== LifecycleStatus.ACTIVE && status !== LifecycleStatus.PAUSED && status !== LifecycleStatus.ARCHIVED) {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
    }
    const dependentGroups = await prisma.trainingGroup.findMany({
      where: { primaryCoachId: coachId, status: { not: LifecycleStatus.ARCHIVED } },
      select: { id: true, internalName: true },
      take: 20
    });
    if (status === LifecycleStatus.ARCHIVED && dependentGroups.length > 0) {
      return NextResponse.json({
        ok: false, error: "COACH_HAS_GROUP_DEPENDENCIES",
        dependencies: { groups: dependentGroups }
      }, { status: 409 });
    }
    if (status !== LifecycleStatus.ACTIVE && await countActiveGroups(prisma, { primaryCoachId: coachId }) > 0) {
      return NextResponse.json({ ok: false, error: "COACH_HAS_ACTIVE_GROUPS" }, { status: 409 });
    }
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.coach.update({ where: { id: coachId }, data: { status } });
      if (status === LifecycleStatus.ARCHIVED) {
        await tx.coachAccount.updateMany({ where: { coachId }, data: { isActive: false } });
      }
      return updated;
    });
    await writeAdminAudit({
      actorId: admin.sub, action: status === LifecycleStatus.ARCHIVED ? "ARCHIVE" : "UPDATE_STATUS",
      entityType: "Coach", entityId: coachId, before, after
    });
    for (const locale of ["ru", "uz"]) {
      revalidatePath(`/${locale}`);
      revalidatePath(`/${locale}/coaches`);
      revalidatePath(`/${locale}/coaches/${coachId}`);
      revalidatePath(`/${locale}/schedule`);
    }
    revalidatePath("/admin/coaches");
    revalidatePath(`/admin/coaches/${coachId}`);
    return NextResponse.json({ ok: true, coach: after });
  }

  const firstName =
    typeof body.firstName === "string"
      ? body.firstName.trim().slice(0, 80)
      : "";

  if (!firstName) {
    return NextResponse.json(
      { ok: false, error: "FIRST_NAME_REQUIRED" },
      { status: 400 }
    );
  }

  const status = String(body.status ?? before.status) as LifecycleStatus;

  if (!Object.values(LifecycleStatus).includes(status)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  if (status !== LifecycleStatus.ACTIVE) {
    const activeGroups = await countActiveGroups(prisma, {
      primaryCoachId: coachId
    });

    if (activeGroups > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "COACH_HAS_ACTIVE_GROUPS",
          dependencies: { activeGroups }
        },
        { status: 409 }
      );
    }
  }

  const yearsRaw =
    body.experienceYears === null ||
    body.experienceYears === undefined ||
    body.experienceYears === ""
      ? null
      : Number(body.experienceYears);

  if (
    yearsRaw !== null &&
    (!Number.isInteger(yearsRaw) || yearsRaw < 0 || yearsRaw > 80)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_EXPERIENCE" },
      { status: 400 }
    );
  }

  const startedAt = optionalDate(body.startedAt);
  if (startedAt === undefined) {
    return NextResponse.json(
      { ok: false, error: "INVALID_START_DATE" },
      { status: 400 }
    );
  }

  const after = await prisma.coach.update({
    where: { id: coachId },
    data: {
      status,
      firstName,
      lastName: optionalString(body.lastName, 80),
      phonePrivate: optionalString(body.phonePrivate, 40),
      experienceYears: yearsRaw,
      educationRu: optionalString(body.educationRu),
      educationUz: optionalString(body.educationUz),
      qualificationRu: optionalString(body.qualificationRu),
      qualificationUz: optionalString(body.qualificationUz),
      publicBioRu: optionalString(body.publicBioRu, 2000),
      publicBioUz: optionalString(body.publicBioUz, 2000),
      seoTitleRu: optionalString(body.seoTitleRu, 180),
      seoTitleUz: optionalString(body.seoTitleUz, 180),
      seoDescriptionRu: optionalString(body.seoDescriptionRu, 320),
      seoDescriptionUz: optionalString(body.seoDescriptionUz, 320),
      startedAt
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "Coach",
    entityId: coachId,
    before,
    after
  });

  revalidatePath("/ru");
  revalidatePath("/uz");
  revalidatePath("/ru/coaches");
  revalidatePath("/uz/coaches");
  revalidatePath("/ru/branches");
  revalidatePath("/uz/branches");
  revalidatePath("/ru/sports");
  revalidatePath("/uz/sports");
  revalidatePath("/ru/schedule");
  revalidatePath("/uz/schedule");
  revalidatePath(`/ru/coaches/${coachId}`);
  revalidatePath(`/uz/coaches/${coachId}`);

  const [branchLinks, sportLinks] = await Promise.all([
    prisma.coachBranch.findMany({
      where: { coachId },
      select: { branchId: true }
    }),
    prisma.coachSport.findMany({
      where: { coachId },
      select: { sportId: true }
    })
  ]);
  const [linkedBranches, linkedSports] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: branchLinks.map((item) => item.branchId) } },
      select: { slug: true }
    }),
    prisma.sport.findMany({
      where: { id: { in: sportLinks.map((item) => item.sportId) } },
      select: { slug: true }
    })
  ]);

  for (const branch of linkedBranches) {
    revalidatePath(`/ru/branches/${branch.slug}`);
    revalidatePath(`/uz/branches/${branch.slug}`);
  }

  for (const sport of linkedSports) {
    revalidatePath(`/ru/sports/${sport.slug}`);
    revalidatePath(`/uz/sports/${sport.slug}`);
  }

  return NextResponse.json({ ok: true, coach: after });
}
