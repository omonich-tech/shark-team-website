import { NextRequest, NextResponse } from "next/server";
import { getCoachSession } from "@/server/coach/auth";
import { createStudentProgressAssessment } from "@/server/progress/student-progress";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ childId: string }> }
) {
  const coach = await getCoachSession();

  if (!coach) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { childId } = await context.params;
  const body = await request.json();

  const result = await createStudentProgressAssessment({
    coachId: coach.coachId,
    childId,
    scores: {
      ability: Number(body.ability),
      discipline: Number(body.discipline),
      motivation: Number(body.motivation),
      coordination: Number(body.coordination),
      physicalPreparation: Number(body.physicalPreparation),
      psychologicalReadiness: Number(body.psychologicalReadiness)
    },
    coachComment:
      typeof body.coachComment === "string" ? body.coachComment : null,
    recommendation:
      typeof body.recommendation === "string" ? body.recommendation : null
  });

  return NextResponse.json(result, {
    status: result.ok
      ? 200
      : result.error === "STUDENT_NOT_AVAILABLE"
        ? 404
        : 400
  });
}
