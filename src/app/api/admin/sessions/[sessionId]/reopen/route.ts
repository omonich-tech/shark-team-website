import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { reopenTrainingSession } from "@/server/sessions/complete-training-session";

export async function POST(
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
  const body = await request.json();
  const reason =
    typeof body.reason === "string" ? body.reason : "";

  const result = await reopenTrainingSession({
    adminId: admin.sub,
    sessionId,
    reason
  });

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.error === "SESSION_NOT_FOUND"
          ? 404
          : result.error === "SESSION_NOT_REOPENABLE"
            ? 409
            : 400
    });
  }

  return NextResponse.json(result);
}
