import {
  PaymentProvider,
  PaymentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { resolveFirstTrialAmount } from "@/server/trial/first-trial-pricing";

export async function createPaymePayment(
  bookingId: string,
  locale: "ru" | "uz",
  origin: string
) {
  const merchantId = process.env.PAYME_MERCHANT_ID;

  if (!merchantId) {
    return { ok: false as const, error: "PAYME_NOT_CONFIGURED" as const };
  }

  const prisma = getPrisma();
  const now = new Date();

  const booking = await prisma.trialBooking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      session: {
        include: {
          group: true
        }
      }
    }
  });

  if (!booking) {
    return { ok: false as const, error: "BOOKING_NOT_FOUND" as const };
  }

  if (
    booking.status === TrialBookingStatus.HOLD &&
    booking.expiresAt <= now
  ) {
    await prisma.trialBooking.update({
      where: { id: booking.id },
      data: { status: TrialBookingStatus.EXPIRED }
    });

    return { ok: false as const, error: "BOOKING_EXPIRED" as const };
  }

  if (
    booking.status !== TrialBookingStatus.HOLD &&
    booking.status !== TrialBookingStatus.PAYMENT_PENDING &&
    booking.status !== TrialBookingStatus.CONFIRMED
  ) {
    return { ok: false as const, error: "BOOKING_NOT_PAYABLE" as const };
  }

  const group = booking.session.group;

  // Never create a payment for an already-confirmed free trial.
  // Preserve existing payment amounts if an administrator changes group pricing.
  const configuredAmount = await resolveFirstTrialAmount(prisma, group.id, now);
  if (!booking.payment && (configuredAmount === 0 || booking.status === TrialBookingStatus.CONFIRMED)) {
    return { ok: false as const, error: "TRIAL_PAYMENT_NOT_REQUIRED" as const };
  }
  const amountUzs = booking.payment?.amountUzs ?? configuredAmount;
  const amountTiyin = amountUzs * 100;

  const payment = booking.payment
    ? booking.payment
    : await prisma.payment.create({
        data: {
          trialBookingId: booking.id,
          provider: PaymentProvider.PAYME,
          status: PaymentStatus.PENDING,
          amountUzs,
          amountTiyin,
          currency: "UZS"
        }
      });

  if (
    payment.amountUzs !== amountUzs ||
    payment.amountTiyin !== amountTiyin
  ) {
    return { ok: false as const, error: "PAYMENT_AMOUNT_LOCKED" as const };
  }

  const checkoutUrl =
    process.env.PAYME_CHECKOUT_URL ?? "https://checkout.paycom.uz/";

  const callback =
    `${origin}/${locale}/trial/payment-return?order=${encodeURIComponent(
      payment.id
    )}&transaction=:transaction`;

  return {
    ok: true as const,
    payment: {
      id: payment.id,
      status: payment.status,
      amountUzs: payment.amountUzs,
      amountTiyin: payment.amountTiyin,
      currency: payment.currency
    },
    checkout: {
      action: checkoutUrl,
      fields: {
        merchant: merchantId,
        amount: String(payment.amountTiyin),
        "account[order_id]": payment.id,
        lang: locale,
        callback,
        callback_timeout: "0"
      }
    }
  };
}
