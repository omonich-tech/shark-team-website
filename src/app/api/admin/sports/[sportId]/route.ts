import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sportId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { sportId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();
  const before = await prisma.sport.findUnique({ where: { id: sportId } });
  if (!before) return NextResponse.json({ ok: false, error: "SPORT_NOT_FOUND" }, { status: 404 });

  const nameRu = typeof body.nameRu === "string" ? body.nameRu.trim().slice(0, 120) : "";
  const nameUz = typeof body.nameUz === "string" ? body.nameUz.trim().slice(0, 120) : "";
  const status = String(body.status ?? before.status) as LifecycleStatus;

  if (!nameRu || !nameUz || !Object.values(LifecycleStatus).includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_SPORT" }, { status: 400 });
  }

  const after = await prisma.sport.update({
    where: { id: sportId },
    data: {
      nameRu,
      nameUz,
      status,
      shortDescriptionRu:
        typeof body.shortDescriptionRu === "string"
          ? body.shortDescriptionRu.trim().slice(0, 1000) || null
          : null,
      shortDescriptionUz:
        typeof body.shortDescriptionUz === "string"
          ? body.shortDescriptionUz.trim().slice(0, 1000) || null
          : null
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "Sport",
    entityId: sportId,
    before,
    after
  });

  return NextResponse.json({ ok: true, sport: after });
}
