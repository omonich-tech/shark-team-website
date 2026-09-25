import { NextRequest, NextResponse } from "next/server";
import { getCoachSession } from "@/server/coach/auth";
import { saveTrialAssessment } from "@/server/coach/save-trial-assessment";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const coach = await getCoachSession();

  if (!coach) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { bookingId } = await context.params;
  const body = await request.json();

  const result = await saveTrialAssessment({
    coachId: coach.coachId,
    trialBookingId: bookingId,
    ability: Number(body.ability),
    discipline: Number(body.discipline),
    motivation: Number(body.motivation),
    coordination: Number(body.coordination),
    physicalPreparation: Number(body.physicalPreparation),
    psychologicalReadiness: Number(body.psychologicalReadiness),
    coachComment:
      typeof body.coachComment === "string" ? body.coachComment : null,
    recommendation:
      typeof body.recommendation === "string" ? body.recommendation : null
  });

  return NextResponse.json(result, {
    status: result.ok
      ? 200
      : result.error === "TRIAL_NOT_FOUND"
        ? 404
        : 400
  });
}
