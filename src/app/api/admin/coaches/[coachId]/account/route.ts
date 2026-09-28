import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { hashCoachPassword } from "@/server/coach/password";

function safeAccount(account: {
  id: string;
  coachId: string;
  username: string;
  isActive: boolean;
}) {
  return {
    id: account.id,
    coachId: account.coachId,
    username: account.username,
    isActive: account.isActive
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ coachId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { coachId } = await context.params;
  const body = await request.json();
  const username =
    typeof body.username === "string"
      ? body.username.trim().toLowerCase()
      : "";
  const password =
    typeof body.password === "string" ? body.password : "";
  const isActive = body.isActive !== false;

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_USERNAME" },
      { status: 400 }
    );
  }

  if (password && password.length < 12) {
    return NextResponse.json(
      { ok: false, error: "COACH_PASSWORD_TOO_SHORT" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { account: true }
  });

  if (!coach) {
    return NextResponse.json(
      { ok: false, error: "COACH_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!coach.account && !password) {
    return NextResponse.json(
      { ok: false, error: "COACH_PASSWORD_REQUIRED" },
      { status: 400 }
    );
  }

  const usernameOwner = await prisma.coachAccount.findUnique({
    where: { username }
  });

  if (usernameOwner && usernameOwner.coachId !== coachId) {
    return NextResponse.json(
      { ok: false, error: "COACH_USERNAME_EXISTS" },
      { status: 409 }
    );
  }

  const credentials = password
    ? await hashCoachPassword(password)
    : null;

  const before = coach.account
    ? safeAccount(coach.account)
    : null;

  const account = await prisma.coachAccount.upsert({
    where: { coachId },
    update: {
      username,
      isActive,
      ...(credentials
        ? {
            passwordHash: credentials.hash,
            passwordSalt: credentials.salt
          }
        : {})
    },
    create: {
      coachId,
      username,
      isActive,
      passwordHash: credentials!.hash,
      passwordSalt: credentials!.salt
    }
  });

  const after = safeAccount(account);

  await writeAdminAudit({
    actorId: admin.sub,
    action: before ? "UPDATE_ACCESS" : "CREATE_ACCESS",
    entityType: "CoachAccount",
    entityId: account.id,
    before,
    after
  });

  return NextResponse.json({
    ok: true,
    account: after
  });
}
