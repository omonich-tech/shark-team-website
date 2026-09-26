import { NextRequest, NextResponse } from "next/server";
import { processDueTelegramNotifications } from "@/server/notifications/telegram-notifications";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
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
