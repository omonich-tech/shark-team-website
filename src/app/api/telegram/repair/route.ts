import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "@/server/security/rate-limit";
import { configureTelegramWebhook } from "@/server/telegram/configure-webhook";

export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

async function handle(request: NextRequest) {
  const expectedChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const providedChatId = request.nextUrl.searchParams.get("chat")?.trim();

  if (
    !expectedChatId ||
    !providedChatId ||
    !safeEqual(expectedChatId, providedChatId)
  ) {
    return NextResponse.json(
      { ok: false, error: "NOT_AUTHORIZED" },
      { status: 403 }
    );
  }

  const rateLimit = await consumeRateLimit(request, {
    namespace: "telegram-webhook-repair-v2",
    limit: 20,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  const result = await configureTelegramWebhook();

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    webhookUrl: result.webhookUrl,
    allowedUpdates: result.allowedUpdates
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
