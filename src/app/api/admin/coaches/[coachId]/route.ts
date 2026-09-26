import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalString(value: unknown, max = 1000) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
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
      publicBioUz: optionalString(body.publicBioUz, 2000)
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

  return NextResponse.json({ ok: true, coach: after });
}
