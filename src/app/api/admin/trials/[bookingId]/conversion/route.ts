import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import {
  offerTrialSubscription,
  setTrialConversionDecision
} from "@/server/enrollment/trial-conversion";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { bookingId } = await context.params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const adminNote =
    typeof body.adminNote === "string" ? body.adminNote : null;

  let result:
    | Awaited<ReturnType<typeof offerTrialSubscription>>
    | Awaited<ReturnType<typeof setTrialConversionDecision>>;

  if (action === "offer") {
    result = await offerTrialSubscription({
      trialBookingId: bookingId,
      adminNote
    });
  } else if (
    action === "thinking" ||
    action === "ready" ||
    action === "decline"
  ) {
    result = await setTrialConversionDecision({
      trialBookingId: bookingId,
      status:
        action === "thinking"
          ? "THINKING"
          : action === "decline"
            ? "DECLINED"
            : "READY",
      adminNote
    });
  } else {
    return NextResponse.json(
      { ok: false, error: "INVALID_ACTION" },
      { status: 400 }
    );
  }

  if (!result.ok) {
    const status =
      result.error === "TRIAL_NOT_READY" ? 409 :
      result.error === "GROUP_FULL" ? 409 :
      result.error === "GROUP_NOT_OPEN" ? 409 :
      result.error === "ALREADY_ENROLLED" ? 409 :
      400;

    return NextResponse.json(result, { status });
  }

  await writeAdminAudit({
    actorId: admin.sub,
    action:
      action === "offer"
        ? "OFFER_SUBSCRIPTION"
        : "SET_TRIAL_CONVERSION_" + action.toUpperCase(),
    entityType: "TrialBooking",
    entityId: bookingId,
    after: result
  });

  return NextResponse.json(result);
}
