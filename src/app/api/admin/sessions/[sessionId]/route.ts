import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { localDateTimeToUtc } from "@/lib/timezone";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import {
  cancelRegularTrainingSession,
  rescheduleRegularTrainingSession
} from "@/server/sessions/manage-training-session";

function parseLocalDateTime(value: unknown, timeZone: string) {
  if (typeof value !== "string") return null;

  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) return null;

  const hour = Number(match[2]);
  const minute = Number(match[3]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return localDateTimeToUtc(match[1], hour, minute, timeZone);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { sessionId } = await context.params;
  const prisma = getPrisma();
  const existing = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      group: {
        include: {
          branch: true
        }
      }
    }
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "SESSION_NOT_FOUND" },
      { status: 404 }
    );
  }

  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "cancel") {
    const result = await cancelRegularTrainingSession({
      sessionId,
      reason:
        typeof body.reason === "string" ? body.reason : null
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status:
          result.error === "SESSION_HAS_ACTIVE_TRIAL_BOOKINGS"
            ? 409
            : 400
      });
    }

    await writeAdminAudit({
      actorId: admin.sub,
      action: "CANCEL_TRAINING_SESSION",
      entityType: "TrainingSession",
      entityId: sessionId,
      before: result.before,
      after: result.session
    });

    return NextResponse.json(result);
  }

  if (action === "reschedule") {
    const startsAt = parseLocalDateTime(
      body.startsAt,
      existing.group.branch.timezone
    );
    const endsAt = parseLocalDateTime(
      body.endsAt,
      existing.group.branch.timezone
    );

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SESSION_TIME" },
        { status: 400 }
      );
    }

    const result = await rescheduleRegularTrainingSession({
      sessionId,
      startsAt,
      endsAt
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status:
          result.error === "SESSION_HAS_ACTIVE_TRIAL_BOOKINGS" ||
          result.error === "SESSION_TIME_CONFLICT"
            ? 409
            : 400
      });
    }

    await writeAdminAudit({
      actorId: admin.sub,
      action: "RESCHEDULE_TRAINING_SESSION",
      entityType: "TrainingSession",
      entityId: sessionId,
      before: result.before,
      after: result.session
    });

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { ok: false, error: "INVALID_ACTION" },
    { status: 400 }
  );
}
