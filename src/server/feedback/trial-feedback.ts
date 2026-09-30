import { TrialBookingStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/server/telegram/send-message";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function ratingText(rating: number, locale: "ru" | "uz") {
  const ru: Record<number, string> = {
    1: "Очень плохо",
    2: "Плохо",
    3: "Нормально",
    4: "Хорошо",
    5: "Отлично"
  };
  const uz: Record<number, string> = {
    1: "Juda yomon",
    2: "Yomon",
    3: "O‘rtacha",
    4: "Yaxshi",
    5: "A’lo"
  };

  return (locale === "uz" ? uz : ru)[rating] ?? String(rating);
}

async function linkedContact(telegramUserId: bigint) {
  const prisma = getPrisma();

  return prisma.telegramContact.findUnique({
    where: { telegramUserId },
    include: {
      lead: true,
      parent: true
    }
  });
}

function ownsBooking(
  contact: Awaited<ReturnType<typeof linkedContact>>,
  booking: {
    leadId: string;
    lead: { parentId: string | null };
  }
) {
  if (!contact) return false;
  if (contact.leadId === booking.leadId) return true;

  return Boolean(
    contact.parentId &&
      booking.lead.parentId &&
      contact.parentId === booking.lead.parentId
  );
}

export async function startParentTrialFeedback(input: {
  telegramUserId: bigint;
  trialBookingId: string;
  rating: number;
}) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false as const, error: "INVALID_RATING" as const };
  }

  const prisma = getPrisma();
  const contact = await linkedContact(input.telegramUserId);

  if (!contact) {
    return { ok: false as const, error: "CONTACT_NOT_LINKED" as const };
  }

  const booking = await prisma.trialBooking.findUnique({
    where: { id: input.trialBookingId },
    include: {
      lead: true
    }
  });

  if (!booking || !ownsBooking(contact, booking)) {
    return { ok: false as const, error: "TRIAL_NOT_FOUND" as const };
  }

  if (booking.status !== TrialBookingStatus.ATTENDED) {
    return { ok: false as const, error: "TRIAL_NOT_ATTENDED" as const };
  }

  const parentId = contact.parentId ?? booking.lead.parentId;

  if (!parentId) {
    return { ok: false as const, error: "PARENT_NOT_LINKED" as const };
  }

  const feedback = await prisma.trialFeedback.upsert({
    where: {
      trialBookingId: booking.id
    },
    update: {
      parentId,
      rating: input.rating,
      comment: null,
      completedAt: null,
      adminNotifiedAt: null
    },
    create: {
      trialBookingId: booking.id,
      parentId,
      rating: input.rating
    }
  });

  return {
    ok: true as const,
    feedback,
    locale: contact.locale === "uz" ? ("uz" as const) : ("ru" as const),
    childName: booking.lead.childName
  };
}

export async function completeParentTrialFeedbackComment(input: {
  telegramUserId: bigint;
  comment: string;
}) {
  const prisma = getPrisma();
  const contact = await linkedContact(input.telegramUserId);

  if (!contact?.parentId) {
    return { ok: false as const, error: "NO_PENDING_FEEDBACK" as const };
  }

  const feedback = await prisma.trialFeedback.findFirst({
    where: {
      parentId: contact.parentId,
      completedAt: null,
      trialBooking: {
        status: TrialBookingStatus.ATTENDED
      }
    },
    include: {
      trialBooking: {
        include: {
          lead: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  if (!feedback) {
    return { ok: false as const, error: "NO_PENDING_FEEDBACK" as const };
  }

  const comment = input.comment.trim().replace(/\s+/g, " ").slice(0, 1200);

  if (comment.length < 2) {
    return { ok: false as const, error: "COMMENT_TOO_SHORT" as const };
  }

  const completedAt = new Date();

  const updated = await prisma.trialFeedback.update({
    where: { id: feedback.id },
    data: {
      comment,
      completedAt,
      adminNotifiedAt: null
    }
  });

  await notifyAdminTrialOutcomeIfReady(feedback.trialBookingId);

  return {
    ok: true as const,
    feedback: updated,
    locale: contact.locale === "uz" ? ("uz" as const) : ("ru" as const),
    childName: feedback.trialBooking.lead.childName
  };
}

export async function skipParentTrialFeedbackComment(input: {
  telegramUserId: bigint;
  trialBookingId: string;
}) {
  const prisma = getPrisma();
  const contact = await linkedContact(input.telegramUserId);

  if (!contact) {
    return { ok: false as const, error: "CONTACT_NOT_LINKED" as const };
  }

  const feedback = await prisma.trialFeedback.findUnique({
    where: {
      trialBookingId: input.trialBookingId
    },
    include: {
      trialBooking: {
        include: {
          lead: true
        }
      }
    }
  });

  if (
    !feedback ||
    feedback.completedAt ||
    !ownsBooking(contact, feedback.trialBooking)
  ) {
    return { ok: false as const, error: "NO_PENDING_FEEDBACK" as const };
  }

  const updated = await prisma.trialFeedback.update({
    where: { id: feedback.id },
    data: {
      completedAt: new Date(),
      adminNotifiedAt: null
    }
  });

  await notifyAdminTrialOutcomeIfReady(feedback.trialBookingId);

  return {
    ok: true as const,
    feedback: updated,
    locale: contact.locale === "uz" ? ("uz" as const) : ("ru" as const),
    childName: feedback.trialBooking.lead.childName
  };
}

export async function notifyAdminTrialOutcomeIfReady(
  trialBookingId: string
) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  if (!chatId) {
    return { ok: false as const, error: "ADMIN_CHAT_NOT_CONFIGURED" as const };
  }

  const prisma = getPrisma();
  const booking = await prisma.trialBooking.findUnique({
    where: { id: trialBookingId },
    include: {
      feedback: true,
      assessment: {
        include: {
          coach: true
        }
      },
      lead: true,
      session: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true,
              primaryCoach: true
            }
          }
        }
      }
    }
  });

  if (
    !booking?.feedback?.completedAt ||
    !booking.assessment ||
    booking.feedback.adminNotifiedAt
  ) {
    return { ok: true as const, sent: false as const };
  }

  const group = booking.session.group;
  const assessment = booking.assessment;
  const feedback = booking.feedback;
  const coachName = [assessment.coach.firstName, assessment.coach.lastName]
    .filter(Boolean)
    .join(" ");

  const scores = [
    assessment.ability,
    assessment.discipline,
    assessment.motivation,
    assessment.coordination,
    assessment.physicalPreparation,
    assessment.psychologicalReadiness
  ];
  const average =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  const message = [
    "<b>🏁 Пробное завершено — готово к обработке</b>",
    "",
    "Ребёнок: <b>" + escapeHtml(booking.lead.childName) + "</b>",
    "Родитель: " + escapeHtml(booking.lead.parentName),
    "Телефон: " + escapeHtml(booking.lead.phone),
    "Направление: " + escapeHtml(group.sport.nameRu),
    "Филиал: " + escapeHtml(group.branch.publicNameRu),
    "",
    "<b>Мнение родителя: " +
      feedback.rating +
      "/5 — " +
      escapeHtml(ratingText(feedback.rating, "ru")) +
      "</b>",
    feedback.comment
      ? "Комментарий: " + escapeHtml(feedback.comment)
      : "Комментарий: без комментария",
    "",
    "<b>Оценка тренера: " + average.toFixed(1) + "/5</b>",
    "Способности: " + assessment.ability + "/5",
    "Дисциплина: " + assessment.discipline + "/5",
    "Мотивация: " + assessment.motivation + "/5",
    "Координация: " + assessment.coordination + "/5",
    "Физподготовка: " + assessment.physicalPreparation + "/5",
    "Психологическая готовность: " +
      assessment.psychologicalReadiness +
      "/5",
    "Тренер: " + escapeHtml(coachName || "—"),
    assessment.coachComment
      ? "Комментарий тренера: " + escapeHtml(assessment.coachComment)
      : "Комментарий тренера: —",
    assessment.recommendation
      ? "Рекомендация: " + escapeHtml(assessment.recommendation)
      : "Рекомендация: —"
  ].join("\n");

  const result = await sendTelegramMessage({
    chatId,
    text: message
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  await prisma.trialFeedback.update({
    where: { id: feedback.id },
    data: {
      adminNotifiedAt: new Date()
    }
  });

  return { ok: true as const, sent: true as const };
}
