import { NextRequest, NextResponse } from "next/server";
import { createPaymePayment } from "@/server/payments/create-payme-payment";
import { getPrisma } from "@/lib/prisma";
import { recordLeadFunnelEvent } from "@/server/analytics/funnel";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit(request, {
    namespace: "payme-init",
    limit: 60,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const bookingId = String(body.bookingId ?? "").trim();
    const locale = body.locale === "uz" ? "uz" : "ru";

    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "BOOKING_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const result = await createPaymePayment(
      bookingId,
      locale,
      request.nextUrl.origin
    );

    if (result.ok) {
      const prisma = getPrisma();
      const booking = await prisma.trialBooking.findUnique({
        where: { id: bookingId },
        select: { leadId: true }
      });
      if (booking) {
        await recordLeadFunnelEvent({
          leadId: booking.leadId,
          eventName: "payment_started",
          bookingId,
          paymentId: result.payment.id,
          dedupeKey: "payment:" + result.payment.id + ":started"
        });
      }
      return NextResponse.json(result, { status: 201 });
    }

    const status =
      result.error === "PAYME_NOT_CONFIGURED"
        ? 503
        : result.error === "BOOKING_EXPIRED" ||
            result.error === "BOOKING_NOT_PAYABLE"
          ? 409
          : 400;

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("Payme payment init failed", error);

    return NextResponse.json(
      { ok: false, error: "PAYMENT_INIT_FAILED" },
      { status: 500 }
    );
  }
}
