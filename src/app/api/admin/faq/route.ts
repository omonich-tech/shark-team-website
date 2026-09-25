import { NextRequest, NextResponse } from "next/server";
import { ContentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

function required(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
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
  const questionRu = required(body.questionRu, 300);
  const questionUz = required(body.questionUz, 300);
  const answerRu = required(body.answerRu, 2000);
  const answerUz = required(body.answerUz, 2000);
  const status = String(body.status ?? "DRAFT") as ContentStatus;
  const sortOrder = Number(body.sortOrder ?? 0);

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

  const prisma = getPrisma();

  const faq = await prisma.faqItem.create({
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
    action: "CREATE",
    entityType: "FaqItem",
    entityId: faq.id,
    after: faq
  });

  return NextResponse.json({ ok: true, faq }, { status: 201 });
}
