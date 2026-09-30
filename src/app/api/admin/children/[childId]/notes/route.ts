import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ childId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { childId } = await context.params;
  const body = await request.json();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

  if (!note) {
    return NextResponse.json({ ok: false, error: "NOTE_REQUIRED" }, { status: 400 });
  }

  const prisma = getPrisma();
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { id: true }
  });

  if (!child) {
    return NextResponse.json({ ok: false, error: "CHILD_NOT_FOUND" }, { status: 404 });
  }

  const created = await prisma.studentAdminNote.create({
    data: {
      childId,
      authorId: admin.sub,
      note
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "ADD_STUDENT_NOTE",
    entityType: "Child",
    entityId: childId,
    after: created
  });

  return NextResponse.json({ ok: true, note: created });
}
