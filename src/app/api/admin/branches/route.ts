import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function required(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
}

function optional(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const internalName = required(body.internalName, 160);
  const publicNameRu = required(body.publicNameRu, 160);
  const publicNameUz = required(body.publicNameUz, 160);
  const addressRu = required(body.addressRu, 300);
  const addressUz = required(body.addressUz, 300);
  const slug = required(body.slug, 120)?.toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!internalName || !publicNameRu || !publicNameUz || !addressRu || !addressUz || !slug) {
    return NextResponse.json({ ok: false, error: "REQUIRED_FIELDS_MISSING" }, { status: 400 });
  }

  const status = String(body.status ?? "DRAFT") as LifecycleStatus;
  if (!Object.values(LifecycleStatus).includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const prisma = getPrisma();

  const exists = await prisma.branch.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json({ ok: false, error: "BRANCH_SLUG_EXISTS" }, { status: 409 });
  }

  const branch = await prisma.branch.create({
    data: {
      id: `BR-${randomUUID()}`,
      slug,
      status,
      internalName,
      publicNameRu,
      publicNameUz,
      addressRu,
      addressUz,
      districtRu: optional(body.districtRu, 120),
      districtUz: optional(body.districtUz, 120),
      landmarkRu: optional(body.landmarkRu, 180),
      landmarkUz: optional(body.landmarkUz, 180),
      publicPhone: optional(body.publicPhone, 40),
      timezone: "Asia/Tashkent"
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE",
    entityType: "Branch",
    entityId: branch.id,
    after: branch
  });

  return NextResponse.json({ ok: true, branch }, { status: 201 });
}
