import { NextRequest, NextResponse } from "next/server";
import { advanceSubscriptionLifecycle } from "@/server/billing/subscription-lifecycle";
import { isCronAuthorized } from "@/server/jobs/auth";
import { processDueTelegramNotifications } from "@/server/notifications/telegram-notifications";
import { queueUpcomingRegularSessionReminders } from "@/server/notifications/regular-session-notifications";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const lifecycle = await advanceSubscriptionLifecycle();
    const regularSessionReminders =
      await queueUpcomingRegularSessionReminders();
    const notifications = await processDueTelegramNotifications();

    return NextResponse.json({
      ok: true,
      lifecycle,
      regularSessionReminders,
      notifications
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
