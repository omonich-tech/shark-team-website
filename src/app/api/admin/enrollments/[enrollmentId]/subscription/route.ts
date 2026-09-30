import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import {
  endEnrollmentSubscription,
  freezeEnrollmentSubscription,
  resumeEnrollmentSubscription
} from "@/server/billing/subscription-controls";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { enrollmentId } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const reason =
    typeof body.reason === "string" ? body.reason : null;

  let result:
    | Awaited<ReturnType<typeof freezeEnrollmentSubscription>>
    | Awaited<ReturnType<typeof resumeEnrollmentSubscription>>
    | Awaited<ReturnType<typeof endEnrollmentSubscription>>;

  if (action === "freeze") {
    result = await freezeEnrollmentSubscription({
      enrollmentId,
      days: Number(body.days),
      reason
    });
  } else if (action === "resume") {
    result = await resumeEnrollmentSubscription({
      enrollmentId,
      reason
    });
  } else if (action === "end") {
    result = await endEnrollmentSubscription({
      enrollmentId,
      reason
    });
  } else {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACTION" },
      { status: 400 }
    );
  }

  if (!result.ok) {
    const conflictErrors = new Set([
      "ALREADY_FROZEN",
      "SUBSCRIPTION_NOT_FREEZABLE",
      "SUBSCRIPTION_ALREADY_DUE",
      "PAYMENT_UNDER_REVIEW",
      "SUBSCRIPTION_NOT_FROZEN",
      "SUBSCRIPTION_ENDED"
    ]);

    return NextResponse.json(result, {
      status: conflictErrors.has(result.error) ? 409 : 400
    });
  }

  await writeAdminAudit({
    actorId: admin.sub,
    action:
      action === "freeze"
        ? "FREEZE_SUBSCRIPTION"
        : action === "resume"
          ? "RESUME_SUBSCRIPTION"
          : "END_SUBSCRIPTION",
    entityType: "StudentEnrollment",
    entityId: enrollmentId,
    after: result
  });

  return NextResponse.json(result);
}
