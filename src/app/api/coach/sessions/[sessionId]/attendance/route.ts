import { NextRequest, NextResponse } from "next/server";
import {
  AbsenceReason,
  AttendanceStatus
} from "@/generated/prisma/client";
import { getCoachSession } from "@/server/coach/auth";
import { markCoachAttendance } from "@/server/coach/mark-attendance";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const coach = await getCoachSession();

  if (!coach) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { sessionId } = await context.params;
  const body = await request.json();
  const childId = String(body.childId ?? "");
  const status = String(body.status ?? "") as AttendanceStatus;
  const absenceReasonRaw =
    typeof body.absenceReason === "string" ? body.absenceReason : "";
  const absenceReason = absenceReasonRaw
    ? (absenceReasonRaw as AbsenceReason)
    : null;
  const absenceNote =
    typeof body.absenceNote === "string" ? body.absenceNote : null;

  if (!Object.values(AttendanceStatus).includes(status)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ATTENDANCE_STATUS" },
      { status: 400 }
    );
  }

  if (
    absenceReason &&
    !Object.values(AbsenceReason).includes(absenceReason)
  ) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ABSENCE_REASON" },
      { status: 400 }
    );
  }

  const result = await markCoachAttendance({
    coachId: coach.coachId,
    sessionId,
    childId,
    status,
    absenceReason,
    absenceNote
  });

  return NextResponse.json(result, {
    status: result.ok
      ? 200
      : result.error === "SESSION_NOT_FOUND"
        ? 404
        : 400
  });
}
