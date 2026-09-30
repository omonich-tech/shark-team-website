import { NextRequest, NextResponse } from "next/server";
import {
  PaymentProvider,
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
import {
  addDays,
  addSubscriptionMonth,
  subscriptionGraceDays
} from "@/server/billing/subscription-period";
import { findSubscriptionPrice } from "@/server/billing/subscription-price";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { enrollmentId } = await context.params;
  const body = await request.json();
  const prisma = getPrisma();
  const now = new Date();

  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      payments: { orderBy: { sequence: "desc" } },
      child: true
    }
  });

  if (!enrollment) {
    return NextResponse.json({ ok: false, error: "ENROLLMENT_NOT_FOUND" }, { status: 404 });
  }

  if (enrollment.status === StudentEnrollmentStatus.ENDED) {
    return NextResponse.json({ ok: false, error: "ENROLLMENT_ENDED" }, { status: 409 });
  }

  if (enrollment.payments.some((payment) => payment.status === PaymentStatus.UNDER_REVIEW)) {
    return NextResponse.json({ ok: false, error: "PAYMENT_UNDER_REVIEW" }, { status: 409 });
  }

  const price = await findSubscriptionPrice(enrollment.groupId, now);
  const requestedAmount = Number(body.amountUzs);
  const amountUzs =
    Number.isInteger(requestedAmount) && requestedAmount > 0
      ? requestedAmount
      : price?.amount ?? 0;

  if (!amountUzs) {
    return NextResponse.json({ ok: false, error: "AMOUNT_REQUIRED" }, { status: 400 });
  }

  const latest = enrollment.payments[0];
  let trialConversionId = latest?.trialConversionId ?? null;

  if (!trialConversionId) {
    const conversion = await prisma.trialConversion.findFirst({
      where: { childId: enrollment.childId },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });
    trialConversionId = conversion?.id ?? null;
  }

  if (!trialConversionId) {
    return NextResponse.json({ ok: false, error: "BILLING_HISTORY_MISSING" }, { status: 409 });
  }

  const pending = enrollment.payments.find(
    (payment) =>
      payment.status === PaymentStatus.PENDING &&
      payment.periodStart &&
      enrollment.currentPeriodEnd &&
      payment.periodStart.getTime() >= enrollment.currentPeriodEnd.getTime()
  );

  const periodStart = pending?.periodStart ?? enrollment.currentPeriodEnd ?? now;
  const periodEnd = pending?.periodEnd ?? addSubscriptionMonth(periodStart);
  const dueAt = pending?.dueAt ?? periodStart;
  const paidAt =
    typeof body.paidAt === "string" && body.paidAt
      ? new Date(body.paidAt + "T12:00:00.000Z")
      : now;

  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ ok: false, error: "INVALID_PAID_AT" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = pending
      ? await tx.subscriptionPayment.update({
          where: { id: pending.id },
          data: {
            provider: PaymentProvider.MANUAL_CARD,
            status: PaymentStatus.PAID,
            amountUzs,
            paidAt,
            submittedAt: paidAt,
            reviewedAt: now,
            reviewedBy: admin.sub
          }
        })
      : await tx.subscriptionPayment.create({
          data: {
            trialConversionId,
            enrollmentId: enrollment.id,
            sequence: (latest?.sequence ?? 0) + 1,
            provider: PaymentProvider.MANUAL_CARD,
            status: PaymentStatus.PAID,
            amountUzs,
            currency: price?.currency ?? "UZS",
            periodStart,
            periodEnd,
            dueAt,
            submittedAt: paidAt,
            reviewedAt: now,
            reviewedBy: admin.sub,
            paidAt
          }
        });

    const updatedEnrollment = await tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: StudentEnrollmentStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextPaymentDueAt: periodEnd,
        graceUntil: addDays(periodEnd, subscriptionGraceDays()),
        pausedAt: null
      }
    });

    return { payment, enrollment: updatedEnrollment };
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "RECORD_MANUAL_SUBSCRIPTION_PAYMENT",
    entityType: "StudentEnrollment",
    entityId: enrollment.id,
    before: {
      subscriptionStatus: enrollment.subscriptionStatus,
      currentPeriodEnd: enrollment.currentPeriodEnd
    },
    after: {
      paymentId: result.payment.id,
      amountUzs: result.payment.amountUzs,
      paidAt: result.payment.paidAt,
      currentPeriodEnd: result.enrollment.currentPeriodEnd
    }
  });

  return NextResponse.json({ ok: true, ...result });
}
