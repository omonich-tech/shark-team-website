import { NextRequest, NextResponse } from "next/server";
import {
  EnrollmentStatus,
  LifecycleStatus,
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
  context: { params: Promise<{ groupId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { groupId } = await context.params;
  const body = await request.json();
  const childId = typeof body.childId === "string" ? body.childId : "";
  const now = new Date();

  if (!childId) {
    return NextResponse.json({ ok: false, error: "CHILD_REQUIRED" }, { status: 400 });
  }

  const prisma = getPrisma();
  const [group, child, existing, price, conversion] = await Promise.all([
    prisma.trainingGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: {
            enrollments: {
              where: { status: StudentEnrollmentStatus.ACTIVE }
            }
          }
        }
      }
    }),
    prisma.child.findUnique({ where: { id: childId } }),
    prisma.studentEnrollment.findFirst({
      where: {
        childId,
        groupId,
        status: {
          in: [StudentEnrollmentStatus.ACTIVE, StudentEnrollmentStatus.PAUSED]
        }
      }
    }),
    findSubscriptionPrice(groupId, now),
    prisma.trialConversion.findFirst({
      where: { childId },
      orderBy: { createdAt: "desc" }
    })
  ]);

  if (!group || group.status !== LifecycleStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "GROUP_UNAVAILABLE" }, { status: 409 });
  }
  if (group.enrollmentStatus === EnrollmentStatus.CLOSED) {
    return NextResponse.json({ ok: false, error: "GROUP_CLOSED" }, { status: 409 });
  }
  if (group._count.enrollments >= group.capacityRegular) {
    return NextResponse.json({ ok: false, error: "GROUP_FULL" }, { status: 409 });
  }
  if (!child) {
    return NextResponse.json({ ok: false, error: "CHILD_NOT_FOUND" }, { status: 404 });
  }
  if (existing) {
    return NextResponse.json({ ok: false, error: "ALREADY_MEMBER" }, { status: 409 });
  }
  if (!price) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_PRICE_MISSING" }, { status: 409 });
  }
  if (!conversion) {
    return NextResponse.json({ ok: false, error: "TRIAL_CONVERSION_REQUIRED" }, { status: 409 });
  }

  const latestPayment = await prisma.subscriptionPayment.findFirst({
    where: { trialConversionId: conversion.id },
    orderBy: { sequence: "desc" }
  });
  const sequence = (latestPayment?.sequence ?? 0) + 1;
  const periodStart = now;
  const periodEnd = addSubscriptionMonth(periodStart);

  const result = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.studentEnrollment.create({
      data: {
        childId,
        groupId,
        status: StudentEnrollmentStatus.ACTIVE,
        subscriptionStatus: SubscriptionStatus.PAYMENT_DUE,
        startDate: now,
        nextPaymentDueAt: now,
        graceUntil: addDays(now, subscriptionGraceDays())
      }
    });

    const payment = await tx.subscriptionPayment.create({
      data: {
        trialConversionId: conversion.id,
        enrollmentId: enrollment.id,
        sequence,
        provider: PaymentProvider.MANUAL_CARD,
        status: PaymentStatus.PENDING,
        amountUzs: price.amount,
        currency: price.currency,
        periodStart,
        periodEnd,
        dueAt: now
      }
    });

    return { enrollment, payment };
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "ADD_STUDENT_TO_GROUP",
    entityType: "StudentEnrollment",
    entityId: result.enrollment.id,
    after: {
      childId,
      groupId,
      paymentId: result.payment.id,
      amountUzs: result.payment.amountUzs
    }
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
