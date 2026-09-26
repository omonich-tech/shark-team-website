import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const nameRu = typeof body.nameRu === "string" ? body.nameRu.trim().slice(0, 120) : "";
  const nameUz = typeof body.nameUz === "string" ? body.nameUz.trim().slice(0, 120) : "";
  const slug = typeof body.slug === "string"
    ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
    : "";

  if (!nameRu || !nameUz || !slug) {
    return NextResponse.json({ ok: false, error: "SPORT_FIELDS_REQUIRED" }, { status: 400 });
  }

  const status = String(body.status ?? "DRAFT") as LifecycleStatus;
  if (!Object.values(LifecycleStatus).includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const prisma = getPrisma();
  const exists = await prisma.sport.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json({ ok: false, error: "SPORT_SLUG_EXISTS" }, { status: 409 });
  }

  const sport = await prisma.sport.create({
    data: {
      id: `SP-${randomUUID()}`,
      slug,
      status,
      nameRu,
      nameUz
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE",
    entityType: "Sport",
    entityId: sport.id,
    after: sport
  });

  return NextResponse.json({ ok: true, sport }, { status: 201 });
}
