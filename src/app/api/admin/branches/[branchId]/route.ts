import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";
import { submitIndexNowUrls } from "@/lib/indexnow";
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

  const internalName = requiredString(body.internalName, 160);
  const publicNameRu = requiredString(body.publicNameRu, 160);
  const publicNameUz = requiredString(body.publicNameUz, 160);
  const addressRu = requiredString(body.addressRu, 300);
  const addressUz = requiredString(body.addressUz, 300);
  const rawSlug = requiredString(body.slug, 120);
  const slug = rawSlug
    ?.toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!internalName || !publicNameRu || !publicNameUz || !addressRu || !addressUz || !slug) {
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

  const conflictingSlug = await prisma.branch.findFirst({
    where: {
      slug,
      id: { not: branchId }
    },
    select: { id: true }
  });

  if (conflictingSlug) {
    return NextResponse.json(
      { ok: false, error: "BRANCH_SLUG_EXISTS" },
      { status: 409 }
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
      internalName,
      slug,
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
      facilityNotesUz: optionalString(body.facilityNotesUz, 700),
      seoTitleRu: optionalString(body.seoTitleRu, 180),
      seoTitleUz: optionalString(body.seoTitleUz, 180),
      seoDescriptionRu: optionalString(body.seoDescriptionRu, 320),
      seoDescriptionUz: optionalString(body.seoDescriptionUz, 320)
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

  revalidatePath("/ru");
  revalidatePath("/uz");
  revalidatePath("/ru/branches");
  revalidatePath("/uz/branches");
  revalidatePath("/ru/contacts");
  revalidatePath("/uz/contacts");
  for (const value of [before.slug, after.slug]) {
    revalidatePath(`/ru/branches/${value}`);
    revalidatePath(`/uz/branches/${value}`);
  }

  if (process.env.VERCEL_ENV === "production") {
    try {
      await submitIndexNowUrls([
        absoluteUrl("/ru"),
        absoluteUrl("/uz"),
        absoluteUrl("/ru/branches"),
        absoluteUrl("/uz/branches"),
        absoluteUrl(`/ru/branches/${after.slug}`),
        absoluteUrl(`/uz/branches/${after.slug}`)
      ]);
    } catch (error) {
      console.error("IndexNow branch update notification failed", error);
    }
  }

  return NextResponse.json({ ok: true, branch: after });
}
