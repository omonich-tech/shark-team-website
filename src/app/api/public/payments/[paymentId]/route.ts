import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await context.params;
    const prisma = getPrisma();

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        trialBooking: true
      }
    });

    if (!payment) {
      return NextResponse.json(
        { ok: false, error: "PAYMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amountUzs: payment.amountUzs,
        currency: payment.currency,
        paidAt: payment.paidAt?.toISOString() ?? null,
        bookingStatus: payment.trialBooking.status
      }
    });
  } catch (error) {
    console.error("Payment status lookup failed", error);

    return NextResponse.json(
      { ok: false, error: "PAYMENT_STATUS_FAILED" },
      { status: 500 }
    );
  }
}
