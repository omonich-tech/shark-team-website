import { NextRequest, NextResponse } from "next/server";
import {
  MediaCategory,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { storeMediaFile } from "@/server/media/storage";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm"
]);

async function targetExists(
  targetType: MediaTargetType,
  targetId: string
) {
  const prisma = getPrisma();

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

  if (targetType === MediaTargetType.SPORT) {
    return Boolean(
      await prisma.sport.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  if (targetType === MediaTargetType.GROUP) {
    return Boolean(
      await prisma.trainingGroup.findUnique({
        where: { id: targetId },
        select: { id: true }
      })
    );
  }

  return Boolean(
    await prisma.contentPage.findUnique({
      where: { id: targetId },
      select: { id: true }
    })
  );
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "FILE_REQUIRED" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MEDIA_FILE" },
      { status: 400 }
    );
  }

  const targetType = String(form.get("targetType") ?? "") as MediaTargetType;
  const targetId = String(form.get("targetId") ?? "").trim();
  const category = String(
    form.get("category") ?? "OTHER"
  ) as MediaCategory;
  const containsMinors = form.get("containsMinors") === "true";
  const requestedConsent = String(
    form.get("consentStatus") ?? "NOT_REQUIRED"
  ) as MediaConsentStatus;
  const isPrimary = form.get("isPrimary") === "true";

  if (
    !Object.values(MediaTargetType).includes(targetType) ||
    !Object.values(MediaCategory).includes(category) ||
    !Object.values(MediaConsentStatus).includes(requestedConsent) ||
    !targetId
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_MEDIA_METADATA" },
      { status: 400 }
    );
  }

  if (!(await targetExists(targetType, targetId))) {
    return NextResponse.json(
      { ok: false, error: "MEDIA_TARGET_NOT_FOUND" },
      { status: 404 }
    );
  }

  const consentStatus = containsMinors
    ? requestedConsent === MediaConsentStatus.APPROVED
      ? MediaConsentStatus.APPROVED
      : MediaConsentStatus.PENDING
    : MediaConsentStatus.NOT_REQUIRED;

  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);

  const stored = await storeMediaFile(
    file,
    `shark/${targetType.toLowerCase()}/${targetId}/${Date.now()}-${safeName}`
  );

  const prisma = getPrisma();

  const asset = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.mediaAsset.updateMany({
        where: {
          targetType,
          targetId,
          category
        },
        data: {
          isPrimary: false
        }
      });
    }

    return tx.mediaAsset.create({
      data: {
        targetType,
        targetId,
        category,
        url: stored.url,
        pathname: stored.pathname,
        contentType: file.type,
        size: file.size,
        isPrimary,
        altRu:
          typeof form.get("altRu") === "string"
            ? String(form.get("altRu")).trim().slice(0, 300) || null
            : null,
        altUz:
          typeof form.get("altUz") === "string"
            ? String(form.get("altUz")).trim().slice(0, 300) || null
            : null,
        containsMinors,
        consentStatus
      }
    });
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPLOAD",
    entityType: "MediaAsset",
    entityId: asset.id,
    after: asset
  });

  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
