import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalString(value: unknown, max = 500) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function requiredString(value: unknown, max = 500) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function PATCH(
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
  const prisma = getPrisma();

  const before = await prisma.branch.findUnique({
    where: { id: branchId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_NOT_FOUND" },
      { status: 404 }
    );
  }

  const publicNameRu = requiredString(body.publicNameRu, 160);
  const publicNameUz = requiredString(body.publicNameUz, 160);
  const addressRu = requiredString(body.addressRu, 300);
  const addressUz = requiredString(body.addressUz, 300);

  if (!publicNameRu || !publicNameUz || !addressRu || !addressUz) {
    return NextResponse.json(
      { ok: false, error: "REQUIRED_FIELDS_MISSING" },
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

  const latitude = optionalNumber(body.latitude);
  const longitude = optionalNumber(body.longitude);

  if (
    latitude === undefined ||
    longitude === undefined ||
    (latitude !== null && (latitude < -90 || latitude > 90)) ||
    (longitude !== null && (longitude < -180 || longitude > 180))
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_COORDINATES" },
      { status: 400 }
    );
  }

  const after = await prisma.branch.update({
    where: { id: branchId },
    data: {
      status,
      publicNameRu,
      publicNameUz,
      districtRu: optionalString(body.districtRu, 120),
      districtUz: optionalString(body.districtUz, 120),
      addressRu,
      addressUz,
      postalCode: optionalString(body.postalCode, 20),
      landmarkRu: optionalString(body.landmarkRu, 180),
      landmarkUz: optionalString(body.landmarkUz, 180),
      entranceNoteRu: optionalString(body.entranceNoteRu, 700),
      entranceNoteUz: optionalString(body.entranceNoteUz, 700),
      latitude,
      longitude,
      publicPhone: optionalString(body.publicPhone, 40),
      workingHoursRu: optionalString(body.workingHoursRu, 180),
      workingHoursUz: optionalString(body.workingHoursUz, 180),
      facilityNotesRu: optionalString(body.facilityNotesRu, 700),
      facilityNotesUz: optionalString(body.facilityNotesUz, 700)
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "Branch",
    entityId: branchId,
    before,
    after
  });

  return NextResponse.json({ ok: true, branch: after });
}
