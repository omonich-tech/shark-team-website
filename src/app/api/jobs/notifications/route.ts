import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/jobs/auth";
import { processDueTelegramNotifications } from "@/server/notifications/telegram-notifications";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const result = await processDueTelegramNotifications();

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("Notification worker failed", error);

    return NextResponse.json(
      { ok: false, error: "NOTIFICATION_WORKER_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
