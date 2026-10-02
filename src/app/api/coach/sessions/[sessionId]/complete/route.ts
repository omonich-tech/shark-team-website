import { NextResponse } from "next/server";
import { getCoachSession } from "@/server/coach/auth";
import { completeCoachTrainingSession } from "@/server/sessions/complete-training-session";

export async function POST(
  _request: Request,
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
  const result = await completeCoachTrainingSession({
    coachId: coach.coachId,
    sessionId
  });

  if (!result.ok) {
    const status =
      result.error === "SESSION_NOT_FOUND"
        ? 404
        : result.error === "ATTENDANCE_INCOMPLETE"
          ? 409
          : 400;

    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
