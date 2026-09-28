import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const firstName =
    typeof body.firstName === "string" ? body.firstName.trim().slice(0, 80) : "";

  if (!firstName) {
    return NextResponse.json({ ok: false, error: "FIRST_NAME_REQUIRED" }, { status: 400 });
  }

  const status = String(body.status ?? "DRAFT") as LifecycleStatus;
  if (!Object.values(LifecycleStatus).includes(status)) {
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }

  const lastName =
    typeof body.lastName === "string" ? body.lastName.trim().slice(0, 80) || null : null;
  const phonePrivate =
    typeof body.phonePrivate === "string" ? body.phonePrivate.trim().slice(0, 40) || null : null;

  const prisma = getPrisma();
  const coach = await prisma.coach.create({
    data: {
      id: `CO-${randomUUID()}`,
      status,
      firstName,
      lastName,
      phonePrivate
    }
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "CREATE",
    entityType: "Coach",
    entityId: coach.id,
    after: coach
  });

  return NextResponse.json({ ok: true, coach }, { status: 201 });
}
