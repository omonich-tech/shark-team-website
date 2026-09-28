import { NextRequest, NextResponse } from "next/server";
import {
  MediaCategory,
  MediaConsentStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { deleteMediaFile } from "@/server/media/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { mediaId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();

  const before = await prisma.mediaAsset.findUnique({
    where: { id: mediaId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "MEDIA_NOT_FOUND" },
      { status: 404 }
    );
  }

  const category = String(body.category ?? before.category) as MediaCategory;
  const consentStatus = String(
    body.consentStatus ?? before.consentStatus
  ) as MediaConsentStatus;
  const sortOrder = Number(body.sortOrder ?? before.sortOrder);
  const isPrimary = Boolean(body.isPrimary ?? before.isPrimary);

  if (
    !Object.values(MediaCategory).includes(category) ||
    !Object.values(MediaConsentStatus).includes(consentStatus) ||
    !Number.isInteger(sortOrder)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MEDIA_METADATA" },
      { status: 400 }
    );
  }

  const normalizedConsent = before.containsMinors
    ? consentStatus
    : MediaConsentStatus.NOT_REQUIRED;

  const after = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.mediaAsset.updateMany({
        where: {
          targetType: before.targetType,
          targetId: before.targetId,
          category,
          NOT: { id: mediaId }
        },
        data: { isPrimary: false }
      });
    }

    return tx.mediaAsset.update({
      where: { id: mediaId },
      data: {
        category,
        consentStatus: normalizedConsent,
        sortOrder,
        isPrimary,
        altRu:
          typeof body.altRu === "string"
            ? body.altRu.trim().slice(0, 300) || null
            : before.altRu,
        altUz:
          typeof body.altUz === "string"
            ? body.altUz.trim().slice(0, 300) || null
            : before.altUz
      }
    });
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "MediaAsset",
    entityId: mediaId,
    before,
    after
  });

  return NextResponse.json({ ok: true, asset: after });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { mediaId } = await context.params;
  const prisma = getPrisma();

  const before = await prisma.mediaAsset.findUnique({
    where: { id: mediaId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "MEDIA_NOT_FOUND" },
      { status: 404 }
    );
  }

  await deleteMediaFile(before.url);
  await prisma.mediaAsset.delete({
    where: { id: mediaId }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "DELETE",
    entityType: "MediaAsset",
    entityId: mediaId,
    before
  });

  return NextResponse.json({ ok: true });
}
