import { NextRequest, NextResponse } from "next/server";
import {
  MediaCategory,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { deleteMediaFile } from "@/server/media/storage";

async function targetExists(
  prisma: ReturnType<typeof getPrisma>,
  targetType: MediaTargetType,
  targetId: string
) {
  if (targetType === MediaTargetType.PAGE) {
    return Boolean(
      await prisma.contentPage.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  if (targetType === MediaTargetType.SPORT) {
    return Boolean(
      await prisma.sport.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  if (targetType === MediaTargetType.BRANCH) {
    return Boolean(
      await prisma.branch.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  if (targetType === MediaTargetType.COACH) {
    return Boolean(
      await prisma.coach.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  return Boolean(
    await prisma.trainingGroup.findUnique({
      where: { id: targetId },
      select: { id: true }
    })
  );
}

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
  const targetType = String(
    body.targetType ?? before.targetType
  ) as MediaTargetType;
  const targetId = String(body.targetId ?? before.targetId).trim();
  const sortOrder = Number(body.sortOrder ?? before.sortOrder);
  const isPrimary = Boolean(body.isPrimary ?? before.isPrimary);

  if (
    !Object.values(MediaCategory).includes(category) ||
    !Object.values(MediaConsentStatus).includes(consentStatus) ||
    !Object.values(MediaTargetType).includes(targetType) ||
    !targetId ||
    !Number.isInteger(sortOrder)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MEDIA_METADATA" },
      { status: 400 }
    );
  }

  if (!(await targetExists(prisma, targetType, targetId))) {
    return NextResponse.json(
      { ok: false, error: "MEDIA_TARGET_NOT_FOUND" },
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
          targetType,
          targetId,
          category,
          NOT: { id: mediaId }
        },
        data: { isPrimary: false }
      });
    }

    return tx.mediaAsset.update({
      where: { id: mediaId },
      data: {
        targetType,
        targetId,
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
