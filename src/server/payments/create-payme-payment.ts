import {
  LifecycleStatus,
  PaymentProvider,
  PaymentStatus,
  PriceProductType,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

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
    ![
      TrialBookingStatus.HOLD,
      TrialBookingStatus.PAYMENT_PENDING,
      TrialBookingStatus.CONFIRMED
    ].includes(booking.status)
  ) {
    return { ok: false as const, error: "BOOKING_NOT_PAYABLE" as const };
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
    orderBy: {
      validFrom: "desc"
    }
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
    return { ok: false as const, error: "TRIAL_PRICE_NOT_FOUND" as const };
  }

  const amountUzs = price.amount;
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
