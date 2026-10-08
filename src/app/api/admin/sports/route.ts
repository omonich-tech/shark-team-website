import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function optionalInt(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
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
  const nameRu =
    typeof body.nameRu === "string" ? body.nameRu.trim().slice(0, 120) : "";
  const nameUz =
    typeof body.nameUz === "string" ? body.nameUz.trim().slice(0, 120) : "";
  const slug =
    typeof body.slug === "string"
      ? body.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 120)
      : "";

  const ageMin = optionalInt(body.ageMin, 3, 99);
  const ageMax = optionalInt(body.ageMax, 3, 99);
  const sortOrder = optionalInt(body.sortOrder, 0, 999);

  if (
    !nameRu ||
    !nameUz ||
    !slug ||
    ageMin === undefined ||
    ageMax === undefined ||
    sortOrder === undefined ||
    (ageMin !== null && ageMax !== null && ageMin > ageMax)
  ) {
    return NextResponse.json(
      { ok: false, error: "SPORT_FIELDS_REQUIRED" },
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

  const prisma = getPrisma();
  const exists = await prisma.sport.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json(
      { ok: false, error: "SPORT_SLUG_EXISTS" },
      { status: 409 }
    );
  }

  const sport = await prisma.sport.create({
    data: {
      id: `SP-${randomUUID()}`,
      slug,
      status,
      nameRu,
      nameUz,
      shortDescriptionRu:
        typeof body.shortDescriptionRu === "string"
          ? body.shortDescriptionRu.trim().slice(0, 1000) || null
          : null,
      shortDescriptionUz:
        typeof body.shortDescriptionUz === "string"
          ? body.shortDescriptionUz.trim().slice(0, 1000) || null
          : null,
      seoTitleRu: optionalString(body.seoTitleRu, 180),
      seoTitleUz: optionalString(body.seoTitleUz, 180),
      seoDescriptionRu: optionalString(body.seoDescriptionRu, 320),
      seoDescriptionUz: optionalString(body.seoDescriptionUz, 320),
      ageMin,
      ageMax,
      sortOrder: sortOrder ?? 0
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE",
    entityType: "Sport",
    entityId: sport.id,
    after: sport
  });

  revalidatePath("/ru");
  revalidatePath("/uz");
  revalidatePath("/ru/sports");
  revalidatePath("/uz/sports");
  revalidatePath(`/ru/sports/${sport.slug}`);
  revalidatePath(`/uz/sports/${sport.slug}`);

  return NextResponse.json({ ok: true, sport }, { status: 201 });
}
