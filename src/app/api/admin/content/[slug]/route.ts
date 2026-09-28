import { NextRequest, NextResponse } from "next/server";
import { ContentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function optionalString(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
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

  const fields = {
    heroEyebrowRu: optionalString(body.heroEyebrowRu, 120),
    heroEyebrowUz: optionalString(body.heroEyebrowUz, 120),
    heroTitleRu: optionalString(body.heroTitleRu, 180),
    heroTitleUz: optionalString(body.heroTitleUz, 180),
    heroLeadRu: optionalString(body.heroLeadRu, 700),
    heroLeadUz: optionalString(body.heroLeadUz, 700),
    seoTitleRu: optionalString(body.seoTitleRu, 180),
    seoTitleUz: optionalString(body.seoTitleUz, 180),
    seoDescriptionRu: optionalString(body.seoDescriptionRu, 320),
    seoDescriptionUz: optionalString(body.seoDescriptionUz, 320)
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
      !fields.heroLeadUz)
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

  return NextResponse.json({ ok: true, content: after });
}
