import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

function sectionsJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 30000) return false;

  try {
    return JSON.parse(serialized) as Prisma.InputJsonObject;
  } catch {
    return false;
  }
}

function patchedString(
  current: string | null,
  value: unknown,
  max: number
) {
  return value === undefined ? current : optionalString(value, max);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();

  const before = await prisma.contentPage.findUnique({
    where: { slug }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "CONTENT_NOT_FOUND" },
      { status: 404 }
    );
  }

  const status = String(body.status ?? before.status) as ContentStatus;

  if (!Object.values(ContentStatus).includes(status)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS" },
      { status: 400 }
    );
  }

  const sectionConfig = sectionsJson(body.sectionsJson);

  if (sectionConfig === false) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SECTIONS_JSON" },
      { status: 400 }
    );
  }

  const fields = {
    heroEyebrowRu: patchedString(before.heroEyebrowRu, body.heroEyebrowRu, 120),
    heroEyebrowUz: patchedString(before.heroEyebrowUz, body.heroEyebrowUz, 120),
    heroTitleRu: patchedString(before.heroTitleRu, body.heroTitleRu, 180),
    heroTitleUz: patchedString(before.heroTitleUz, body.heroTitleUz, 180),
    heroLeadRu: patchedString(before.heroLeadRu, body.heroLeadRu, 700),
    heroLeadUz: patchedString(before.heroLeadUz, body.heroLeadUz, 700),
    bodyRu: patchedString(before.bodyRu, body.bodyRu, 6000),
    bodyUz: patchedString(before.bodyUz, body.bodyUz, 6000),
    contactPhone: patchedString(before.contactPhone, body.contactPhone, 80),
    contactTelegram: patchedString(
      before.contactTelegram,
      body.contactTelegram,
      300
    ),
    contactInstagram: patchedString(
      before.contactInstagram,
      body.contactInstagram,
      300
    ),
    contactEmail: patchedString(before.contactEmail, body.contactEmail, 180),
    contactHoursRu: patchedString(
      before.contactHoursRu,
      body.contactHoursRu,
      300
    ),
    contactHoursUz: patchedString(
      before.contactHoursUz,
      body.contactHoursUz,
      300
    ),
    seoTitleRu: patchedString(before.seoTitleRu, body.seoTitleRu, 180),
    seoTitleUz: patchedString(before.seoTitleUz, body.seoTitleUz, 180),
    seoDescriptionRu: patchedString(
      before.seoDescriptionRu,
      body.seoDescriptionRu,
      320
    ),
    seoDescriptionUz: patchedString(
      before.seoDescriptionUz,
      body.seoDescriptionUz,
      320
    )
  };

  if (Object.values(fields).some((value) => value === undefined)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_FIELD_TYPE" },
      { status: 400 }
    );
  }

  if (
    status === ContentStatus.PUBLISHED &&
    (!fields.heroTitleRu ||
      !fields.heroTitleUz ||
      !fields.heroLeadRu ||
      !fields.heroLeadUz ||
      (slug === "about" && (!fields.bodyRu || !fields.bodyUz)))
  ) {
    return NextResponse.json(
      { ok: false, error: "PUBLISHED_CONTENT_INCOMPLETE" },
      { status: 400 }
    );
  }

  const after = await prisma.contentPage.update({
    where: { slug },
    data: {
      status,
      ...fields,
      ...(sectionConfig !== undefined
        ? {
            sectionsJson:
              sectionConfig === null ? Prisma.DbNull : sectionConfig
          }
        : {}),
      publishedAt:
        status === ContentStatus.PUBLISHED
          ? before.publishedAt ?? new Date()
          : before.publishedAt
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "ContentPage",
    entityId: after.id,
    before,
    after
  });

  const publicPath =
    slug === "home" ? "" : `/${slug}`;
  revalidatePath(`/ru${publicPath}`);
  revalidatePath(`/uz${publicPath}`);

  return NextResponse.json({ ok: true, content: after });
}
