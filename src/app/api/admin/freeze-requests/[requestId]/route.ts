import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import { reviewParentFreezeRequest } from "@/server/billing/parent-freeze-request";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const { requestId } = await context.params;
  const body = await request.json();
  const approve = body.approve === true;
  const decisionNote =
    typeof body.decisionNote === "string"
      ? body.decisionNote
      : null;

  const result = await reviewParentFreezeRequest({
    requestId,
    approve,
    reviewedBy: admin.sub,
    decisionNote
  });

  if (!result.ok) {
    const conflictErrors = new Set([
      "ALREADY_FROZEN",
      "SUBSCRIPTION_NOT_FREEZABLE",
      "SUBSCRIPTION_ALREADY_DUE",
      "PAYMENT_UNDER_REVIEW",
      "SUBSCRIPTION_ENDED"
    ]);

    return NextResponse.json(result, {
      status: conflictErrors.has(result.error) ? 409 : 400
    });
  }

  await writeAdminAudit({
    actorId: admin.sub,
    action: approve
      ? "APPROVE_SUBSCRIPTION_FREEZE_REQUEST"
      : "REJECT_SUBSCRIPTION_FREEZE_REQUEST",
    entityType: "SubscriptionFreezeRequest",
    entityId: requestId,
    after: result
  });

  return NextResponse.json(result);
}
