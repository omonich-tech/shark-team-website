import { NextRequest, NextResponse } from "next/server";
import { ContentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function required(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ faqId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { faqId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();

  const before = await prisma.faqItem.findUnique({
    where: { id: faqId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "FAQ_NOT_FOUND" },
      { status: 404 }
    );
  }

  const questionRu = required(body.questionRu, 300);
  const questionUz = required(body.questionUz, 300);
  const answerRu = required(body.answerRu, 2000);
  const answerUz = required(body.answerUz, 2000);
  const status = String(body.status ?? before.status) as ContentStatus;
  const sortOrder = Number(body.sortOrder ?? before.sortOrder);

  if (!questionRu || !questionUz || !answerRu || !answerUz) {
    return NextResponse.json(
      { ok: false, error: "FAQ_FIELDS_REQUIRED" },
      { status: 400 }
    );
  }

  if (
    !Object.values(ContentStatus).includes(status) ||
    !Number.isInteger(sortOrder)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_FAQ" },
      { status: 400 }
    );
  }

  const after = await prisma.faqItem.update({
    where: { id: faqId },
    data: {
      status,
      branchId:
        typeof body.branchId === "string" && body.branchId
          ? body.branchId
          : null,
      sportId:
        typeof body.sportId === "string" && body.sportId
          ? body.sportId
          : null,
      questionRu,
      questionUz,
      answerRu,
      answerUz,
      sortOrder
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "UPDATE",
    entityType: "FaqItem",
    entityId: faqId,
    before,
    after
  });

  return NextResponse.json({ ok: true, faq: after });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ faqId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { faqId } = await context.params;
  const prisma = getPrisma();

  const before = await prisma.faqItem.findUnique({
    where: { id: faqId }
  });

  if (!before) {
    return NextResponse.json(
      { ok: false, error: "FAQ_NOT_FOUND" },
      { status: 404 }
    );
  }

  await prisma.faqItem.delete({
    where: { id: faqId }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "DELETE",
    entityType: "FaqItem",
    entityId: faqId,
    before
  });

  return NextResponse.json({ ok: true });
}
