import { NextRequest, NextResponse } from "next/server";
import { reserveTrialBooking } from "@/server/trial/reserve-trial-booking";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const leadId = String(body.leadId ?? "").trim();

    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: "LEAD_ID_REQUIRED" },
        { status: 400 }
      );
    }

    const result = await reserveTrialBooking(leadId);

    if (result.ok) {
      return NextResponse.json(result, { status: 201 });
    }

    const status =
      result.error === "SLOT_FULL" ||
      result.error === "SESSION_NOT_AVAILABLE"
        ? 409
        : 400;

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("Trial reservation API failed", error);

    return NextResponse.json(
      { ok: false, error: "RESERVATION_FAILED" },
      { status: 500 }
    );
  }
}
