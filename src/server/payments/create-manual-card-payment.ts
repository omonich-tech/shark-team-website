import {
  PaymentProvider,
  PaymentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { resolveFirstTrialAmount } from "@/server/trial/first-trial-pricing";

function formatCardNumber(value: string) {
  const digits = value.replace(/\D+/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export async function createManualCardPayment(bookingId: string) {
  const rawCardNumber = process.env.MANUAL_PAYMENT_CARD_NUMBER?.trim() ?? "";
  const cardDigits = rawCardNumber.replace(/\D+/g, "");
  const cardHolder = process.env.MANUAL_PAYMENT_CARD_HOLDER?.trim() || null;

  if (cardDigits.length < 12 || cardDigits.length > 19) {
    return {
      ok: false as const,
      error: "MANUAL_PAYMENT_NOT_CONFIGURED" as const
    };
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
    return {
      ok: false as const,
      error: "BOOKING_NOT_PAYABLE" as const
    };
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

  if (
    booking.payment &&
    booking.payment.provider !== PaymentProvider.MANUAL_CARD
  ) {
    return {
      ok: false as const,
      error: "PAYMENT_PROVIDER_LOCKED" as const
    };
  }

  const payment = booking.payment
    ? booking.payment
    : await prisma.payment.create({
        data: {
          trialBookingId: booking.id,
          provider: PaymentProvider.MANUAL_CARD,
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
    return {
      ok: false as const,
      error: "PAYMENT_AMOUNT_LOCKED" as const
    };
  }

  return {
    ok: true as const,
    payment: {
      id: payment.id,
      status: payment.status,
      amountUzs: payment.amountUzs,
      currency: payment.currency
    },
    manualCard: {
      cardNumber: formatCardNumber(cardDigits),
      cardLast4: cardDigits.slice(-4),
      cardHolder
    }
  };
}
