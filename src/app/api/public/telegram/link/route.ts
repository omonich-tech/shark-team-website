import { NextRequest, NextResponse } from "next/server";
import { createTelegramLinkForBooking } from "@/server/telegram/link";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const bookingId = String(body.bookingId ?? "").trim();

    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "BOOKING_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const result = await createTelegramLinkForBooking(bookingId);

    return NextResponse.json(result, {
      status: result.ok
        ? 201
        : result.error === "TELEGRAM_NOT_CONFIGURED"
          ? 503
          : result.error === "BOOKING_NOT_FOUND"
            ? 404
            : 409
    });
  } catch (error) {
    console.error("Telegram link initialization failed", error);

    return NextResponse.json(
      { ok: false, error: "TELEGRAM_LINK_FAILED" },
      { status: 500 }
    );
  }
}
