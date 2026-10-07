import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalInt(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function cleanSlug(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
    : "";
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sportId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { sportId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();
  const before = await prisma.sport.findUnique({ where: { id: sportId } });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "SPORT_NOT_FOUND" },
      { status: 404 }
    );
  }

  const nameRu =
    typeof body.nameRu === "string" ? body.nameRu.trim().slice(0, 120) : "";
  const nameUz =
    typeof body.nameUz === "string" ? body.nameUz.trim().slice(0, 120) : "";
  const slug = cleanSlug(body.slug);
  const status = String(body.status ?? before.status) as LifecycleStatus;
  const ageMin = optionalInt(body.ageMin, 3, 99);
  const ageMax = optionalInt(body.ageMax, 3, 99);
  const sortOrder = optionalInt(body.sortOrder, 0, 999);

  if (
    !nameRu ||
    !nameUz ||
    !slug ||
    !Object.values(LifecycleStatus).includes(status) ||
    ageMin === undefined ||
    ageMax === undefined ||
    sortOrder === undefined ||
    (ageMin !== null && ageMax !== null && ageMin > ageMax)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SPORT" },
      { status: 400 }
    );
  }

  const conflict = await prisma.sport.findFirst({
    where: {
      slug,
      id: { not: sportId }
    },
    select: { id: true }
  });

  if (conflict) {
    return NextResponse.json(
      { ok: false, error: "SPORT_SLUG_EXISTS" },
      { status: 409 }
    );
  }

  const after = await prisma.sport.update({
    where: { id: sportId },
    data: {
      nameRu,
      nameUz,
      slug,
      status,
      ageMin,
      ageMax,
      sortOrder: sortOrder ?? 0,
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
