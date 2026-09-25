import { NextRequest, NextResponse } from "next/server";
import { AttendanceStatus } from "@/generated/prisma/client";
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

  if (!Object.values(AttendanceStatus).includes(status)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ATTENDANCE_STATUS" },
      { status: 400 }
    );
  }

  const result = await markCoachAttendance({
    coachId: coach.coachId,
    sessionId,
    childId,
    status
  });

  return NextResponse.json(result, {
    status: result.ok
      ? 200
      : result.error === "SESSION_NOT_FOUND"
        ? 404
        : 400
  });
}
