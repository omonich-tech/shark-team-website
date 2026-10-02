import {
  PaymentStatus,
  StudentEnrollmentStatus,
  SubscriptionFreezeRequestStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { freezeEnrollmentSubscription } from "@/server/billing/subscription-controls";
import { sendTelegramMessage } from "@/server/telegram/send-message";

export type ParentFreezeReason =
  | "ILLNESS"
  | "TRAVEL"
  | "FAMILY"
  | "OTHER";

const FREEZE_DAYS = new Set([7, 14, 30]);
const FREEZE_REASONS = new Set<ParentFreezeReason>([
  "ILLNESS",
  "TRAVEL",
  "FAMILY",
  "OTHER"
]);

export function parentFreezeReasonLabel(
  reason: string,
  locale: "ru" | "uz"
) {
  const ru: Record<string, string> = {
    ILLNESS: "болезнь",
    TRAVEL: "поездка",
    FAMILY: "семейные обстоятельства",
    OTHER: "другая причина"
  };
  const uz: Record<string, string> = {
    ILLNESS: "kasallik",
    TRAVEL: "safar",
    FAMILY: "oilaviy sabab",
    OTHER: "boshqa sabab"
  };

  return (locale === "uz" ? uz : ru)[reason] ?? reason;
}

function localeOf(value: string | null | undefined): "ru" | "uz" {
  return value === "uz" ? "uz" : "ru";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function createParentFreezeRequest(input: {
  telegramUserId: bigint;
  enrollmentId: string;
  days: number;
  reason: ParentFreezeReason;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId: input.telegramUserId }
  });
  const locale = localeOf(contact?.locale);

  if (!contact?.parentId) {
    return {
      ok: false as const,
      error: "PARENT_NOT_LINKED" as const,
      locale
    };
  }

  if (!FREEZE_DAYS.has(input.days)) {
    return {
      ok: false as const,
      error: "INVALID_FREEZE_DAYS" as const,
      locale
    };
  }

  if (!FREEZE_REASONS.has(input.reason)) {
    return {
      ok: false as const,
      error: "INVALID_FREEZE_REASON" as const,
      locale
    };
  }

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      id: input.enrollmentId,
      child: { parentId: contact.parentId }
    },
    include: {
      child: true,
      group: {
        include: {
          sport: true,
          branch: true
        }
      },
      payments: {
        orderBy: { sequence: "desc" },
        take: 3
      },
      freezeRequests: {
        where: {
          status: SubscriptionFreezeRequestStatus.PENDING
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!enrollment) {
    return {
      ok: false as const,
      error: "ENROLLMENT_NOT_AVAILABLE" as const,
      locale
    };
  }

  const existing = enrollment.freezeRequests[0];

  if (existing) {
    return {
      ok: false as const,
      error: "FREEZE_REQUEST_ALREADY_PENDING" as const,
      locale,
      request: existing
    };
  }

  if (
    enrollment.status !== StudentEnrollmentStatus.ACTIVE ||
    enrollment.subscriptionStatus === SubscriptionStatus.FROZEN ||
    enrollment.subscriptionStatus === SubscriptionStatus.PAST_DUE ||
    enrollment.subscriptionStatus === SubscriptionStatus.PAUSED ||
    enrollment.subscriptionStatus === SubscriptionStatus.ENDED ||
    !enrollment.currentPeriodEnd ||
    !enrollment.nextPaymentDueAt
  ) {
    return {
      ok: false as const,
      error: "SUBSCRIPTION_NOT_FREEZABLE" as const,
      locale
    };
  }

  if (
    enrollment.subscriptionStatus === SubscriptionStatus.PAYMENT_DUE &&
    enrollment.nextPaymentDueAt <= now
  ) {
    return {
      ok: false as const,
      error: "SUBSCRIPTION_ALREADY_DUE" as const,
      locale
    };
  }

  if (
    enrollment.payments.some(
      (payment) => payment.status === PaymentStatus.UNDER_REVIEW
    )
  ) {
    return {
      ok: false as const,
      error: "PAYMENT_UNDER_REVIEW" as const,
      locale
    };
  }

  const request = await prisma.subscriptionFreezeRequest.create({
    data: {
      enrollmentId: enrollment.id,
      parentId: contact.parentId,
      days: input.days,
      reason: input.reason
    }
  });

  const sportName =
    locale === "uz"
      ? enrollment.group.sport.nameUz
      : enrollment.group.sport.nameRu;

  return {
    ok: true as const,
    locale,
    request,
    childId: enrollment.childId,
    childName: enrollment.child.name,
    sportName,
    groupName: enrollment.group.internalName
  };
}

export async function reviewParentFreezeRequest(input: {
  requestId: string;
  approve: boolean;
  reviewedBy: string;
  decisionNote?: string | null;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const request = await prisma.subscriptionFreezeRequest.findUnique({
    where: { id: input.requestId },
    include: {
      parent: true,
      enrollment: {
        include: {
          child: true,
          group: {
            include: {
              sport: true,
              branch: true
            }
          }
        }
      }
    }
  });

  if (!request) {
    return {
      ok: false as const,
      error: "FREEZE_REQUEST_NOT_FOUND" as const
    };
  }

  if (request.status !== SubscriptionFreezeRequestStatus.PENDING) {
    return {
      ok: true as const,
      alreadyProcessed: true as const,
      approved:
        request.status === SubscriptionFreezeRequestStatus.APPROVED,
      request
    };
  }

  const decisionNote =
    input.decisionNote?.trim().slice(0, 500) || null;

  if (input.approve) {
    const freeze = await freezeEnrollmentSubscription({
      enrollmentId: request.enrollmentId,
      days: request.days,
      reason:
        "Запрос родителя: " +
        parentFreezeReasonLabel(request.reason, "ru"),
      now
    });

    if (!freeze.ok) {
      return {
        ok: false as const,
        error: freeze.error,
        request
      };
    }

    const updated = await prisma.subscriptionFreezeRequest.update({
      where: { id: request.id },
      data: {
        status: SubscriptionFreezeRequestStatus.APPROVED,
        reviewedAt: now,
        reviewedBy: input.reviewedBy,
        decisionNote
      }
    });

    return {
      ok: true as const,
      alreadyProcessed: false as const,
      approved: true as const,
      request: updated,
      enrollment: freeze.enrollment
    };
  }

  const updated = await prisma.subscriptionFreezeRequest.update({
    where: { id: request.id },
    data: {
      status: SubscriptionFreezeRequestStatus.REJECTED,
      reviewedAt: now,
      reviewedBy: input.reviewedBy,
      decisionNote
    }
  });

  const contact = await prisma.telegramContact.findFirst({
    where: {
      parentId: request.parentId
    },
    orderBy: {
      verifiedAt: "desc"
    }
  });

  if (contact) {
    const locale = localeOf(contact.locale);
    const sportName =
      locale === "uz"
        ? request.enrollment.group.sport.nameUz
        : request.enrollment.group.sport.nameRu;
    const reason = parentFreezeReasonLabel(
      request.reason,
      locale
    );

    const text =
      locale === "uz"
        ? [
            "❌ <b>Abonementni muzlatish so‘rovi rad etildi</b>",
            "",
            "Bola: <b>" + escapeHtml(request.enrollment.child.name) + "</b>",
            "Yo‘nalish: " + escapeHtml(sportName),
            "Muddat: " + request.days + " kun",
            "Sabab: " + escapeHtml(reason),
            decisionNote
              ? "Administrator izohi: " + escapeHtml(decisionNote)
              : ""
          ].filter(Boolean).join("\n")
        : [
            "❌ <b>Запрос на заморозку абонемента отклонён</b>",
            "",
            "Ребёнок: <b>" + escapeHtml(request.enrollment.child.name) + "</b>",
            "Направление: " + escapeHtml(sportName),
            "Срок: " + request.days + " дней",
            "Причина: " + escapeHtml(reason),
            decisionNote
              ? "Комментарий администратора: " + escapeHtml(decisionNote)
              : ""
          ].filter(Boolean).join("\n");

    await sendTelegramMessage({
      chatId: contact.chatId,
      text
    });
  }

  return {
    ok: true as const,
    alreadyProcessed: false as const,
    approved: false as const,
    request: updated
  };
}
