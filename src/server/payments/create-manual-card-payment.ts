import {
  LifecycleStatus,
  PaymentProvider,
  PaymentStatus,
  PriceProductType,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

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

  const prices = await prisma.price.findMany({
    where: {
      productType: PriceProductType.TRIAL,
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
      AND: [
        {
          OR: [
            { groupId: group.id },
            {
              groupId: null,
              branchId: group.branchId,
              sportId: group.sportId
            },
            {
              groupId: null,
              branchId: group.branchId,
              sportId: null
            },
            {
              groupId: null,
              branchId: null,
              sportId: group.sportId
            }
          ]
        }
      ]
    },
    orderBy: { validFrom: "desc" }
  });

  const price =
    prices.find((item) => item.groupId === group.id) ??
    prices.find(
      (item) =>
        item.branchId === group.branchId &&
        item.sportId === group.sportId
    ) ??
    prices.find((item) => item.branchId === group.branchId) ??
    prices.find((item) => item.sportId === group.sportId);

  if (!price) {
    return {
      ok: false as const,
      error: "TRIAL_PRICE_NOT_FOUND" as const
    };
  }

  const amountUzs = price.amount;
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
