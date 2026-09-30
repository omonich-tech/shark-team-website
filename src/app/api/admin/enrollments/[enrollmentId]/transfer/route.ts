import { NextRequest, NextResponse } from "next/server";
import {
  EnrollmentStatus,
  LifecycleStatus,
  PaymentStatus,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAdminSession } from "@/server/admin/auth";
import { writeAdminAudit } from "@/server/admin/audit";
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
  const targetGroupId = typeof body.targetGroupId === "string" ? body.targetGroupId : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  if (!targetGroupId) {
    return NextResponse.json({ ok: false, error: "TARGET_GROUP_REQUIRED" }, { status: 400 });
  }

  const prisma = getPrisma();
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      group: true,
      payments: { orderBy: { sequence: "desc" } }
    }
  });

  if (!enrollment) {
    return NextResponse.json({ ok: false, error: "ENROLLMENT_NOT_FOUND" }, { status: 404 });
  }

  if (enrollment.status === StudentEnrollmentStatus.ENDED) {
    return NextResponse.json({ ok: false, error: "ENROLLMENT_ENDED" }, { status: 409 });
  }

  if (enrollment.groupId === targetGroupId) {
    return NextResponse.json({ ok: false, error: "SAME_GROUP" }, { status: 409 });
  }

  const target = await prisma.trainingGroup.findUnique({
    where: { id: targetGroupId },
    include: {
      _count: {
        select: {
          enrollments: {
            where: { status: StudentEnrollmentStatus.ACTIVE }
          }
        }
      }
    }
  });

  if (!target || target.status !== LifecycleStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "TARGET_GROUP_UNAVAILABLE" }, { status: 409 });
  }

  if (target.enrollmentStatus === EnrollmentStatus.CLOSED) {
    return NextResponse.json({ ok: false, error: "TARGET_GROUP_CLOSED" }, { status: 409 });
  }

  if (target._count.enrollments >= target.capacityRegular) {
    return NextResponse.json({ ok: false, error: "TARGET_GROUP_FULL" }, { status: 409 });
  }

  const duplicate = await prisma.studentEnrollment.findFirst({
    where: {
      childId: enrollment.childId,
      groupId: targetGroupId,
      status: { in: [StudentEnrollmentStatus.ACTIVE, StudentEnrollmentStatus.PAUSED] },
      id: { not: enrollment.id }
    },
    select: { id: true }
  });

  if (duplicate) {
    return NextResponse.json({ ok: false, error: "ALREADY_IN_TARGET_GROUP" }, { status: 409 });
  }

  if (enrollment.payments.some((payment) => payment.status === PaymentStatus.UNDER_REVIEW)) {
    return NextResponse.json({ ok: false, error: "PAYMENT_UNDER_REVIEW" }, { status: 409 });
  }

  const targetPrice = await findSubscriptionPrice(targetGroupId);
  const pendingIds = enrollment.payments
    .filter((payment) =>
      payment.status === PaymentStatus.PENDING &&
      payment.periodStart &&
      enrollment.currentPeriodEnd &&
      payment.periodStart.getTime() >= enrollment.currentPeriodEnd.getTime()
    )
    .map((payment) => payment.id);

  if (pendingIds.length > 0 && !targetPrice) {
    return NextResponse.json({ ok: false, error: "TARGET_PRICE_MISSING" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (pendingIds.length > 0 && targetPrice) {
      await tx.subscriptionPayment.updateMany({
        where: { id: { in: pendingIds } },
        data: {
          amountUzs: targetPrice.amount,
          currency: targetPrice.currency
        }
      });
    }

    return tx.studentEnrollment.update({
      where: { id: enrollment.id },
      data: { groupId: targetGroupId }
    });
  });

  await writeAdminAudit({
    actorId: admin.sub,
    action: "TRANSFER_STUDENT_GROUP",
    entityType: "StudentEnrollment",
    entityId: enrollment.id,
    before: {
      groupId: enrollment.groupId,
      groupName: enrollment.group.internalName
    },
    after: {
      groupId: targetGroupId,
      reason
    }
  });

  return NextResponse.json({ ok: true, enrollment: updated });
}
