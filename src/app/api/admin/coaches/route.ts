import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
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

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await request.json();
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

  const status = String(body.status ?? "DRAFT") as LifecycleStatus;
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

  const startedAt = optionalDate(body.startedAt);
  if (startedAt === undefined) {
    return NextResponse.json(
      { ok: false, error: "INVALID_START_DATE" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const coach = await prisma.coach.create({
    data: {
      id: `CO-${randomUUID()}`,
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
    action: "CREATE",
    entityType: "Coach",
    entityId: coach.id,
    after: coach
  });

  revalidatePath("/ru");
  revalidatePath("/uz");
  revalidatePath("/ru/coaches");
  revalidatePath("/uz/coaches");
  revalidatePath(`/ru/coaches/${coach.id}`);
  revalidatePath(`/uz/coaches/${coach.id}`);

  return NextResponse.json({ ok: true, coach }, { status: 201 });
}
