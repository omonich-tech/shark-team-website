import { NextRequest, NextResponse } from "next/server";
import { createManualCardPayment } from "@/server/payments/create-manual-card-payment";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit(request, {
    namespace: "manual-card-init",
    limit: 60,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const bookingId = String(body.bookingId ?? "").trim();

    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "BOOKING_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const result = await createManualCardPayment(bookingId);

    if (result.ok) {
      return NextResponse.json(result, { status: 201 });
    }

    const status =
      result.error === "MANUAL_PAYMENT_NOT_CONFIGURED"
        ? 503
        : result.error === "BOOKING_EXPIRED" ||
            result.error === "BOOKING_NOT_PAYABLE" ||
            result.error === "PAYMENT_PROVIDER_LOCKED"
          ? 409
          : 400;

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("Manual card payment init failed", error);

    return NextResponse.json(
      { ok: false, error: "PAYMENT_INIT_FAILED" },
      { status: 500 }
    );
  }
}
