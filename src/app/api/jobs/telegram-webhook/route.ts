import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/jobs/auth";
import { configureTelegramWebhook } from "@/server/telegram/configure-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const result = await configureTelegramWebhook();

    return NextResponse.json(
      result,
      { status: result.ok ? 200 : 500 }
    );
  } catch (error) {
    console.error("Telegram webhook configuration failed", error);

    return NextResponse.json(
      { ok: false, error: "TELEGRAM_WEBHOOK_CONFIG_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
