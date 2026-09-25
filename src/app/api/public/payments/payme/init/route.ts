import { NextRequest, NextResponse } from "next/server";
import { createPaymePayment } from "@/server/payments/create-payme-payment";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
