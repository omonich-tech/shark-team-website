import {
  NotificationStatus,
  NotificationType,
  Prisma,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { absenceReasonLabel } from "@/server/attendance/absence-reason";
import { sendTelegramMessage } from "@/server/telegram/send-message";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function envMinutes(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatCard(value: string) {
  const digits = value.replace(/\s+/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatDay(value: Date, locale: "ru" | "uz") {
  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(value);
}

function formatDate(value: Date, locale: "ru" | "uz") {
  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export async function queueHoldReminder(input: {
  bookingId: string;
  leadId: string;
  reminderAt: Date | null;
}) {
  if (!input.reminderAt) return null;

  const prisma = getPrisma();

  return prisma.notification.upsert({
    where: {
      dedupeKey: `trial:${input.bookingId}:payment-hold-reminder`
    },
    update: {
      scheduledAt: input.reminderAt,
      status: NotificationStatus.PENDING,
      lastError: null
    },
    create: {
      type: NotificationType.PAYMENT_HOLD_REMINDER,
      leadId: input.leadId,
      trialBookingId: input.bookingId,
      scheduledAt: input.reminderAt,
      dedupeKey: `trial:${input.bookingId}:payment-hold-reminder`
    }
  });
}

export async function queueConfirmedTrialNotifications(input: {
  bookingId: string;
  leadId: string;
  parentId: string;
  startsAt: Date;
  endsAt: Date;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const reminderMinutes = envMinutes("TRIAL_REMINDER_MINUTES", 180);
  const feedbackMinutes = envMinutes("POST_TRIAL_FEEDBACK_MINUTES", 30);

  const reminderAt = new Date(
    input.startsAt.getTime() - reminderMinutes * 60_000
  );

  const feedbackAt = new Date(
    input.endsAt.getTime() + feedbackMinutes * 60_000
  );

  await prisma.$transaction([
    prisma.notification.upsert({
      where: {
        dedupeKey: `trial:${input.bookingId}:confirmed`
      },
      update: {
        parentId: input.parentId,
        scheduledAt: now,
        status: NotificationStatus.PENDING,
        lastError: null
      },
      create: {
        type: NotificationType.TRIAL_CONFIRMED,
        leadId: input.leadId,
        parentId: input.parentId,
        trialBookingId: input.bookingId,
        scheduledAt: now,
        dedupeKey: `trial:${input.bookingId}:confirmed`
      }
    }),
    prisma.notification.upsert({
      where: {
        dedupeKey: `trial:${input.bookingId}:reminder`
      },
      update: {
        parentId: input.parentId,
        scheduledAt: reminderAt > now ? reminderAt : now,
        status: NotificationStatus.PENDING,
        lastError: null
      },
      create: {
        type: NotificationType.TRIAL_REMINDER,
        leadId: input.leadId,
        parentId: input.parentId,
        trialBookingId: input.bookingId,
        scheduledAt: reminderAt > now ? reminderAt : now,
        dedupeKey: `trial:${input.bookingId}:reminder`
      }
    }),
    prisma.notification.upsert({
      where: {
        dedupeKey: `trial:${input.bookingId}:feedback`
      },
      update: {
        parentId: input.parentId,
        scheduledAt: feedbackAt,
        status: NotificationStatus.PENDING,
        lastError: null
      },
      create: {
        type: NotificationType.POST_TRIAL_FEEDBACK,
        leadId: input.leadId,
        parentId: input.parentId,
        trialBookingId: input.bookingId,
        scheduledAt: feedbackAt,
        dedupeKey: `trial:${input.bookingId}:feedback`
      }
    })
  ]);
}

type NotificationWithContext = Prisma.NotificationGetPayload<{
  include: {
    lead: true;
    parent: true;
    trialBooking: {
      include: {
        feedback: true;
        session: {
          include: {
            group: {
              include: {
                branch: true;
              };
            };
          };
        };
      };
    };
    enrollment: {
      include: {
        child: true;
        group: {
          include: {
            branch: true;
          };
        };
      };
    };
    subscriptionPayment: true;
    attendance: {
      include: {
        child: true;
        session: {
          include: {
            group: {
              include: {
                branch: true;
                sport: true;
              };
            };
          };
        };
      };
    };
    progressAssessment: {
      include: {
        child: true;
        group: {
          include: {
            branch: true;
            sport: true;
          };
        };
        coach: true;
      };
    };
  };
}>;

async function renderNotification(
  notification: NotificationWithContext
) {
  const locale: "ru" | "uz" =
    notification.parent?.locale === "uz" ||
    notification.lead?.locale === "uz"
      ? "uz"
      : "ru";

  const booking = notification.trialBooking;
  const childName = escapeHtml(notification.lead?.childName ?? "");
  const session = booking?.session;
  const branch = session?.group?.branch;

  if (
    notification.type === NotificationType.REGULAR_SESSION_REMINDER ||
    notification.type === NotificationType.REGULAR_SESSION_CANCELLED ||
    notification.type === NotificationType.REGULAR_SESSION_RESCHEDULED
  ) {
    const regularSession = notification.trainingSession;
    const enrollment = notification.enrollment;

    if (!regularSession || !enrollment) {
      return locale === "uz"
        ? "Mashg‘ulot ma’lumotlarini topib bo‘lmadi."
        : "Не удалось загрузить данные тренировки.";
    }

    const child = escapeHtml(enrollment.child.name);
    const sport =
      locale === "uz"
        ? regularSession.group.sport.nameUz
        : regularSession.group.sport.nameRu;
    const branchName =
      locale === "uz"
        ? regularSession.group.branch.publicNameUz
        : regularSession.group.branch.publicNameRu;
    const address =
      locale === "uz"
        ? regularSession.group.branch.addressUz
        : regularSession.group.branch.addressRu;
    const coach = escapeHtml(
      [
        regularSession.coach.firstName,
        regularSession.coach.lastName
      ]
        .filter(Boolean)
        .join(" ") || "—"
    );

    if (
      notification.type ===
      NotificationType.REGULAR_SESSION_REMINDER
    ) {
      const date = formatDate(regularSession.startsAt, locale);

      return locale === "uz"
        ? [
            "🏀 <b>SHARK TEAM mashg‘ulot eslatmasi</b>",
            "",
            "Bola: <b>" + child + "</b>",
            "Yo‘nalish: " + escapeHtml(sport),
            "Vaqt: <b>" + escapeHtml(date) + "</b>",
            "Filial: " + escapeHtml(branchName),
            "Manzil: " + escapeHtml(address),
            "Murabbiy: " + coach,
            "",
            "Iltimos, mashg‘ulotga 10–15 daqiqa oldin keling."
          ].join("\n")
        : [
            "🏀 <b>Напоминание о тренировке SHARK TEAM</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            "Направление: " + escapeHtml(sport),
            "Время: <b>" + escapeHtml(date) + "</b>",
            "Филиал: " + escapeHtml(branchName),
            "Адрес: " + escapeHtml(address),
            "Тренер: " + coach,
            "",
            "Пожалуйста, приходите за 10–15 минут до начала."
          ].join("\n");
    }

    if (
      notification.type ===
      NotificationType.REGULAR_SESSION_CANCELLED
    ) {
      const date = formatDate(regularSession.startsAt, locale);
      const context =
        notification.contextJson &&
        typeof notification.contextJson === "object" &&
        !Array.isArray(notification.contextJson)
          ? notification.contextJson
          : null;
      const reason =
        context &&
        "reason" in context &&
        typeof context.reason === "string"
          ? context.reason
          : null;

      return locale === "uz"
        ? [
            "❌ <b>SHARK TEAM mashg‘uloti bekor qilindi</b>",
            "",
            "Bola: <b>" + child + "</b>",
            "Yo‘nalish: " + escapeHtml(sport),
            "Mashg‘ulot: " + escapeHtml(date),
            "Filial: " + escapeHtml(branchName),
            reason ? "Sabab: " + escapeHtml(reason) : "",
            "",
            "Keyingi mashg‘ulotlar jadval bo‘yicha davom etadi."
          ].filter(Boolean).join("\n")
        : [
            "❌ <b>Тренировка SHARK TEAM отменена</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            "Направление: " + escapeHtml(sport),
            "Тренировка: " + escapeHtml(date),
            "Филиал: " + escapeHtml(branchName),
            reason ? "Причина: " + escapeHtml(reason) : "",
            "",
            "Следующие тренировки продолжаются по расписанию."
          ].filter(Boolean).join("\n");
    }

    const context =
      notification.contextJson &&
      typeof notification.contextJson === "object" &&
      !Array.isArray(notification.contextJson)
        ? notification.contextJson
        : null;
    const oldStartsAt =
      context &&
      "oldStartsAt" in context &&
      typeof context.oldStartsAt === "string"
        ? new Date(context.oldStartsAt)
        : null;
    const oldDate =
      oldStartsAt && !Number.isNaN(oldStartsAt.getTime())
        ? formatDate(oldStartsAt, locale)
        : "—";
    const newDate = formatDate(regularSession.startsAt, locale);

    return locale === "uz"
      ? [
          "🔄 <b>SHARK TEAM mashg‘uloti ko‘chirildi</b>",
          "",
          "Bola: <b>" + child + "</b>",
          "Yo‘nalish: " + escapeHtml(sport),
          "Oldingi vaqt: <s>" + escapeHtml(oldDate) + "</s>",
          "Yangi vaqt: <b>" + escapeHtml(newDate) + "</b>",
          "Filial: " + escapeHtml(branchName),
          "Manzil: " + escapeHtml(address),
          "Murabbiy: " + coach
        ].join("\n")
      : [
          "🔄 <b>Тренировка SHARK TEAM перенесена</b>",
          "",
          "Ребёнок: <b>" + child + "</b>",
          "Направление: " + escapeHtml(sport),
          "Было: <s>" + escapeHtml(oldDate) + "</s>",
          "Стало: <b>" + escapeHtml(newDate) + "</b>",
          "Филиал: " + escapeHtml(branchName),
          "Адрес: " + escapeHtml(address),
          "Тренер: " + coach
        ].join("\n");
  }

  if (notification.type === NotificationType.STUDENT_PROGRESS_UPDATE) {
    const assessment = notification.progressAssessment;

    if (!assessment) {
      return locale === "uz"
        ? "Rivojlanish hisoboti ma’lumotlarini topib bo‘lmadi."
        : "Не удалось загрузить отчёт о развитии.";
    }

    const child = escapeHtml(assessment.child.name);
    const average =
      (
        assessment.ability +
        assessment.discipline +
        assessment.motivation +
        assessment.coordination +
        assessment.physicalPreparation +
        assessment.psychologicalReadiness
      ) / 6;
    const coach = escapeHtml(
      [assessment.coach.firstName, assessment.coach.lastName]
        .filter(Boolean)
        .join(" ") || "—"
    );

    return locale === "uz"
      ? [
          "📈 <b>SHARK TEAM rivojlanish hisoboti</b>",
          "",
          "Bola: <b>" + child + "</b>",
          "Sport: " + escapeHtml(assessment.group.sport.nameUz),
          "Murabbiy: " + coach,
          "O‘rtacha baho: <b>" + average.toFixed(1) + " / 5</b>",
          "",
          "Ko‘nikma: " + assessment.ability + "/5",
          "Intizom: " + assessment.discipline + "/5",
          "Motivatsiya: " + assessment.motivation + "/5",
          "Koordinatsiya: " + assessment.coordination + "/5",
          "Jismoniy tayyorgarlik: " + assessment.physicalPreparation + "/5",
          "Psixologik tayyorgarlik: " + assessment.psychologicalReadiness + "/5",
          assessment.coachComment
            ? "Murabbiy izohi: " + escapeHtml(assessment.coachComment)
            : null,
          assessment.recommendation
            ? "Tavsiya: " + escapeHtml(assessment.recommendation)
            : null
        ].filter(Boolean).join("\n")
      : [
          "📈 <b>Отчёт о развитии SHARK TEAM</b>",
          "",
          "Ребёнок: <b>" + child + "</b>",
          "Направление: " + escapeHtml(assessment.group.sport.nameRu),
          "Тренер: " + coach,
          "Средняя оценка: <b>" + average.toFixed(1) + " / 5</b>",
          "",
          "Навыки: " + assessment.ability + "/5",
          "Дисциплина: " + assessment.discipline + "/5",
          "Мотивация: " + assessment.motivation + "/5",
          "Координация: " + assessment.coordination + "/5",
          "Физподготовка: " + assessment.physicalPreparation + "/5",
          "Психологическая готовность: " + assessment.psychologicalReadiness + "/5",
          assessment.coachComment
            ? "Комментарий тренера: " + escapeHtml(assessment.coachComment)
            : null,
          assessment.recommendation
            ? "Рекомендация: " + escapeHtml(assessment.recommendation)
            : null
        ].filter(Boolean).join("\n");
  }

  if (notification.type === NotificationType.REGULAR_ABSENCE_NOTICE) {
    const attendance = notification.attendance;

    if (!attendance) {
      return locale === "uz"
        ? "Davomat ma’lumotlarini topib bo‘lmadi."
        : "Не удалось загрузить данные посещаемости.";
    }

    const child = escapeHtml(attendance.child.name);
    const group = attendance.session.group;
    const sessionDate = formatDate(attendance.session.startsAt, locale);
    const statusText =
      attendance.status === "EXCUSED"
        ? locale === "uz"
          ? "sababli kelmadi"
          : "уважительный пропуск"
        : locale === "uz"
          ? "mashg‘ulotga kelmadi"
          : "отсутствовал на тренировке";
    const reason = attendance.absenceReason
      ? absenceReasonLabel(attendance.absenceReason, locale)
      : null;

    return locale === "uz"
      ? [
          "📋 <b>Davomat — SHARK TEAM</b>",
          "",
          "Bola: <b>" + child + "</b>",
          "Mashg‘ulot: " + escapeHtml(sessionDate),
          "Guruh: " + escapeHtml(group.internalName),
          "Holat: " + statusText + ".",
          reason ? "Sabab: <b>" + escapeHtml(reason) + "</b>" : "",
          "",
          reason
            ? "Davomat ma’lumoti saqlandi."
            : "Iltimos, kelmaganlik sababini tanlang."
        ].filter(Boolean).join("\n")
      : [
          "📋 <b>Посещаемость — SHARK TEAM</b>",
          "",
          "Ребёнок: <b>" + child + "</b>",
          "Занятие: " + escapeHtml(sessionDate),
          "Группа: " + escapeHtml(group.internalName),
          "Статус: " + statusText + ".",
          reason ? "Причина: <b>" + escapeHtml(reason) + "</b>" : "",
          "",
          reason
            ? "Информация о посещаемости сохранена."
            : "Пожалуйста, укажите причину пропуска."
        ].filter(Boolean).join("\n");
  }

  if (
    notification.type === NotificationType.SUBSCRIPTION_FROZEN ||
    notification.type === NotificationType.SUBSCRIPTION_RESUMED ||
    notification.type === NotificationType.SUBSCRIPTION_ENDED
  ) {
    const enrollment = notification.enrollment;

    if (!enrollment) {
      return locale === "uz"
        ? "Abonement ma’lumotlarini topib bo‘lmadi."
        : "Не удалось загрузить данные абонемента.";
    }

    const child = escapeHtml(enrollment.child.name);
    const paidThrough = enrollment.currentPeriodEnd
      ? formatDay(enrollment.currentPeriodEnd, locale)
      : "";
    const freezeUntil = enrollment.freezeUntil
      ? formatDay(enrollment.freezeUntil, locale)
      : "";

    if (notification.type === NotificationType.SUBSCRIPTION_FROZEN) {
      return locale === "uz"
        ? [
            "❄️ <b>Abonement muzlatildi</b>",
            "",
            "Bola: <b>" + child + "</b>",
            freezeUntil ? "Muzlatish muddati: " + freezeUntil + " gacha." : "",
            paidThrough ? "Yangi amal qilish muddati: " + paidThrough + " gacha." : "",
            "",
            "Muzlatish tugagach abonement avtomatik tiklanadi."
          ].filter(Boolean).join("\n")
        : [
            "❄️ <b>Абонемент заморожен</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            freezeUntil ? "Заморозка до " + freezeUntil + "." : "",
            paidThrough ? "Новая дата окончания оплаченного периода: " + paidThrough + "." : "",
            "",
            "После окончания заморозки абонемент восстановится автоматически."
          ].filter(Boolean).join("\n");
    }

    if (notification.type === NotificationType.SUBSCRIPTION_RESUMED) {
      return locale === "uz"
        ? [
            "▶️ <b>Abonement qayta faollashtirildi</b>",
            "",
            "Bola: <b>" + child + "</b>",
            paidThrough ? "Abonement " + paidThrough + " gacha amal qiladi." : ""
          ].filter(Boolean).join("\n")
        : [
            "▶️ <b>Абонемент возобновлён</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            paidThrough ? "Абонемент оплачен до " + paidThrough + "." : ""
          ].filter(Boolean).join("\n");
    }

    return locale === "uz"
      ? [
          "⛔ <b>Abonement yakunlandi</b>",
          "",
          "Bola: <b>" + child + "</b>",
          "Doimiy guruhdagi abonement yopildi."
        ].join("\n")
      : [
          "⛔ <b>Абонемент прекращён</b>",
          "",
          "Ребёнок: <b>" + child + "</b>",
          "Абонемент в постоянной группе закрыт."
        ].join("\n");
  }

  if (
    notification.type === NotificationType.SUBSCRIPTION_RENEWAL_REMINDER ||
    notification.type === NotificationType.SUBSCRIPTION_PAST_DUE ||
    notification.type === NotificationType.SUBSCRIPTION_PAUSED
  ) {
    const enrollment = notification.enrollment;
    const payment = notification.subscriptionPayment;

    if (!enrollment || !payment) {
      return locale === "uz"
        ? "Abonement ma’lumotlarini topib bo‘lmadi. Administrator bilan bog‘laning."
        : "Не удалось загрузить данные абонемента. Свяжитесь с администратором.";
    }

    const cardNumber = process.env.MANUAL_PAYMENT_CARD_NUMBER?.trim();
    const card = cardNumber ? formatCard(cardNumber) : null;
    const child = escapeHtml(enrollment.child.name);
    const amount = formatMoney(payment.amountUzs);
    const due = payment.dueAt
      ? formatDay(payment.dueAt, locale)
      : "";
    const grace = enrollment.graceUntil
      ? formatDay(enrollment.graceUntil, locale)
      : "";

    if (notification.type === NotificationType.SUBSCRIPTION_RENEWAL_REMINDER) {
      return locale === "uz"
        ? [
            "💳 <b>SHARK TEAM abonementini uzaytirish</b>",
            "",
            "Bola: <b>" + child + "</b>",
            "Joriy abonement " + due + " gacha amal qiladi.",
            "Keyingi oy: <b>" + amount + " so‘m</b>",
            card ? "Karta: <code>" + card + "</code>" : "",
            "",
            "To‘lovdan so‘ng chek yoki skrinshotni shu chatga yuboring."
          ].filter(Boolean).join("\n")
        : [
            "💳 <b>Продление абонемента SHARK TEAM</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            "Текущий абонемент действует до " + due + ".",
            "Следующий месяц: <b>" + amount + " сум</b>",
            card ? "Карта: <code>" + card + "</code>" : "",
            "",
            "После перевода отправьте чек или скриншот прямо сюда."
          ].filter(Boolean).join("\n");
    }

    if (notification.type === NotificationType.SUBSCRIPTION_PAST_DUE) {
      return locale === "uz"
        ? [
            "⚠️ <b>Abonement to‘lovi muddati keldi</b>",
            "",
            "Bola: <b>" + child + "</b>",
            "To‘lov: <b>" + amount + " so‘m</b>",
            grace ? "Imtiyozli muddat: " + grace + " gacha." : "",
            card ? "Karta: <code>" + card + "</code>" : "",
            "",
            "To‘lovdan so‘ng chekni shu chatga yuboring."
          ].filter(Boolean).join("\n")
        : [
            "⚠️ <b>Наступил срок оплаты абонемента</b>",
            "",
            "Ребёнок: <b>" + child + "</b>",
            "К оплате: <b>" + amount + " сум</b>",
            grace ? "Льготный период действует до " + grace + "." : "",
            card ? "Карта: <code>" + card + "</code>" : "",
            "",
            "После оплаты отправьте чек в этот чат."
          ].filter(Boolean).join("\n");
    }

    return locale === "uz"
      ? [
          "⏸ <b>Abonement vaqtincha to‘xtatildi</b>",
          "",
          "Bola: <b>" + child + "</b>",
          "Sabab: abonement to‘lovi tasdiqlanmagan.",
          "To‘lov: <b>" + amount + " so‘m</b>",
          card ? "Karta: <code>" + card + "</code>" : "",
          "",
          "To‘lovdan so‘ng chekni yuboring. Tasdiqlangach abonement qayta faollashadi."
        ].filter(Boolean).join("\n")
      : [
          "⏸ <b>Абонемент временно приостановлен</b>",
          "",
          "Ребёнок: <b>" + child + "</b>",
          "Причина: оплата абонемента не подтверждена.",
          "К оплате: <b>" + amount + " сум</b>",
          card ? "Карта: <code>" + card + "</code>" : "",
          "",
          "После оплаты отправьте чек. После подтверждения абонемент будет восстановлен."
        ].filter(Boolean).join("\n");
  }

  if (notification.type === NotificationType.PAYMENT_HOLD_REMINDER) {
    const expires = booking?.expiresAt
      ? formatDate(booking.expiresAt, locale)
      : "";

    return locale === "uz"
      ? `⏳ <b>${childName}</b> uchun sinov joyi ${expires} gacha saqlanadi. Joyni tasdiqlash uchun to‘lovni yakunlang.`
      : `⏳ Место на пробное для <b>${childName}</b> удерживается до ${expires}. Завершите оплату, чтобы подтвердить бронь.`;
  }

  if (notification.type === NotificationType.TRIAL_CONFIRMED) {
    const date = session ? formatDate(session.startsAt, locale) : "";

    return locale === "uz"
      ? `✅ Sinov mashg‘uloti tasdiqlandi. <b>${childName}</b> — ${date}. ${branch?.publicNameUz ?? ""}`
      : `✅ Пробное занятие подтверждено. <b>${childName}</b> — ${date}. ${branch?.publicNameRu ?? ""}`;
  }

  if (notification.type === NotificationType.TRIAL_REMINDER) {
    const date = session ? formatDate(session.startsAt, locale) : "";
    const address =
      locale === "uz" ? branch?.addressUz : branch?.addressRu;

    return locale === "uz"
      ? `🏀 Eslatma: <b>${childName}</b>ning sinov mashg‘uloti ${date}. Manzil: ${address ?? ""}`
      : `🏀 Напоминание: пробное занятие <b>${childName}</b> — ${date}. Адрес: ${address ?? ""}`;
  }

  return locale === "uz"
    ? `💬 <b>${childName}</b>ning sinov mashg‘uloti qanday o‘tdi? Quyida baholang, keyin xohlasangiz izoh yozishingiz mumkin.`
    : `💬 Как прошло пробное занятие у <b>${childName}</b>? Оцените одним нажатием ниже — затем при желании сможете добавить комментарий.`;
}

export async function processDueTelegramNotifications(
  now = new Date(),
  limit = 50
) {
  const prisma = getPrisma();

  const due = await prisma.notification.findMany({
    where: {
      status: NotificationStatus.PENDING,
      scheduledAt: { lte: now },
      attempts: { lt: 5 }
    },
    include: {
      lead: true,
      parent: true,
      trialBooking: {
        include: {
          feedback: true,
          session: {
            include: {
              group: {
                include: {
                  branch: true
                }
              }
            }
          }
        }
      },
      enrollment: {
        include: {
          child: true,
          group: {
            include: {
              branch: true
            }
          }
        }
      },
      subscriptionPayment: true,
      attendance: {
        include: {
          child: true,
          session: {
            include: {
              group: {
                include: {
                  branch: true,
                  sport: true
                }
              }
            }
          }
        }
      },
      progressAssessment: {
        include: {
          child: true,
          group: {
            include: {
              branch: true,
              sport: true
            }
          },
          coach: true
        }
      },
      trainingSession: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true
            }
          },
          coach: true
        }
      }
    },
    orderBy: {
      scheduledAt: "asc"
    },
    take: limit
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of due) {
    if (notification.type === NotificationType.POST_TRIAL_FEEDBACK) {
      const booking = notification.trialBooking;

      if (!booking || booking.feedback?.completedAt) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SKIPPED,
            lastError: booking ? "FEEDBACK_ALREADY_COMPLETED" : "BOOKING_MISSING"
          }
        });
        skipped += 1;
        continue;
      }

      if (booking.status !== TrialBookingStatus.ATTENDED) {
        const canWaitForAttendance =
          booking.status === TrialBookingStatus.CONFIRMED &&
          now.getTime() - booking.session.endsAt.getTime() <=
            24 * 60 * 60 * 1000;

        if (canWaitForAttendance) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              scheduledAt: new Date(now.getTime() + 15 * 60_000),
              lastError: "WAITING_FOR_ATTENDANCE"
            }
          });
        } else {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: NotificationStatus.SKIPPED,
              lastError: "TRIAL_NOT_ATTENDED"
            }
          });
          skipped += 1;
        }

        continue;
      }
    }

    if (
      notification.type === NotificationType.REGULAR_SESSION_REMINDER
    ) {
      const session = notification.trainingSession;
      const enrollment = notification.enrollment;

      if (
        !session ||
        !enrollment ||
        session.status !== "SCHEDULED" ||
        session.startsAt <= now ||
        enrollment.status !== "ACTIVE" ||
        enrollment.subscriptionStatus === "FROZEN" ||
        enrollment.subscriptionStatus === "PAUSED" ||
        enrollment.subscriptionStatus === "ENDED"
      ) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SKIPPED,
            lastError: !session || !enrollment
              ? "REGULAR_SESSION_CONTEXT_MISSING"
              : "REGULAR_SESSION_STATE_CHANGED"
          }
        });
        skipped += 1;
        continue;
      }
    }

    if (
      notification.type === NotificationType.REGULAR_SESSION_CANCELLED &&
      notification.trainingSession?.status !== "CANCELLED"
    ) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SKIPPED,
          lastError: "SESSION_NOT_CANCELLED"
        }
      });
      skipped += 1;
      continue;
    }

    if (
      notification.type === NotificationType.REGULAR_SESSION_RESCHEDULED &&
      (!notification.trainingSession ||
        notification.trainingSession.status !== "SCHEDULED")
    ) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SKIPPED,
          lastError: "SESSION_NOT_SCHEDULED"
        }
      });
      skipped += 1;
      continue;
    }

    if (notification.type === NotificationType.REGULAR_ABSENCE_NOTICE) {
      const attendance = notification.attendance;

      if (
        !attendance ||
        attendance.trialBookingId ||
        attendance.status === "PRESENT"
      ) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SKIPPED,
            lastError: !attendance
              ? "ATTENDANCE_CONTEXT_MISSING"
              : "ATTENDANCE_CHANGED"
          }
        });
        skipped += 1;
        continue;
      }
    }

    if (
      notification.type === NotificationType.SUBSCRIPTION_FROZEN ||
      notification.type === NotificationType.SUBSCRIPTION_RESUMED ||
      notification.type === NotificationType.SUBSCRIPTION_ENDED
    ) {
      const enrollment = notification.enrollment;

      const valid =
        Boolean(enrollment) &&
        (notification.type === NotificationType.SUBSCRIPTION_FROZEN
          ? enrollment?.subscriptionStatus === "FROZEN"
          : notification.type === NotificationType.SUBSCRIPTION_ENDED
            ? enrollment?.subscriptionStatus === "ENDED"
            : enrollment?.subscriptionStatus !== "FROZEN" &&
              enrollment?.subscriptionStatus !== "ENDED");

      if (!valid) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SKIPPED,
            lastError: enrollment
              ? "SUBSCRIPTION_STATE_CHANGED"
              : "SUBSCRIPTION_CONTEXT_MISSING"
          }
        });
        skipped += 1;
        continue;
      }
    }

    if (
      notification.type === NotificationType.SUBSCRIPTION_RENEWAL_REMINDER ||
      notification.type === NotificationType.SUBSCRIPTION_PAST_DUE ||
      notification.type === NotificationType.SUBSCRIPTION_PAUSED
    ) {
      const enrollment = notification.enrollment;
      const payment = notification.subscriptionPayment;

      const expectedStatus =
        notification.type === NotificationType.SUBSCRIPTION_RENEWAL_REMINDER
          ? "PAYMENT_DUE"
          : notification.type === NotificationType.SUBSCRIPTION_PAST_DUE
            ? "PAST_DUE"
            : "PAUSED";

      if (
        !enrollment ||
        !payment ||
        payment.status === "PAID" ||
        enrollment.subscriptionStatus !== expectedStatus
      ) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SKIPPED,
            lastError: !enrollment || !payment
              ? "SUBSCRIPTION_CONTEXT_MISSING"
              : payment.status === "PAID"
                ? "SUBSCRIPTION_ALREADY_PAID"
                : "SUBSCRIPTION_STATE_CHANGED"
          }
        });
        skipped += 1;
        continue;
      }
    }

    const contact = await prisma.telegramContact.findFirst({
      where: {
        OR: [
          ...(notification.parentId
            ? [{ parentId: notification.parentId }]
            : []),
          ...(notification.leadId
            ? [{ leadId: notification.leadId }]
            : [])
        ]
      },
      orderBy: {
        verifiedAt: "desc"
      }
    });

    if (!contact) {
      const attempts = notification.attempts + 1;
      const tooOld =
        now.getTime() - notification.scheduledAt.getTime() >
        24 * 60 * 60 * 1000;

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          attempts,
          status:
            attempts >= 5 || tooOld
              ? NotificationStatus.SKIPPED
              : NotificationStatus.PENDING,
          lastError: "NO_TELEGRAM_CONTACT"
        }
      });

      if (attempts >= 5 || tooOld) skipped += 1;
      continue;
    }

    const text = await renderNotification(notification);
    const replyMarkup =
      notification.type === NotificationType.POST_TRIAL_FEEDBACK &&
      notification.trialBookingId
        ? {
            inline_keyboard: [
              [
                {
                  text: "1 😞",
                  callback_data:
                    "feedback:1:" + notification.trialBookingId
                },
                {
                  text: "2 🙁",
                  callback_data:
                    "feedback:2:" + notification.trialBookingId
                },
                {
                  text: "3 😐",
                  callback_data:
                    "feedback:3:" + notification.trialBookingId
                }
              ],
              [
                {
                  text: "4 🙂",
                  callback_data:
                    "feedback:4:" + notification.trialBookingId
                },
                {
                  text: "5 😍",
                  callback_data:
                    "feedback:5:" + notification.trialBookingId
                }
              ]
            ]
          }
        : notification.type === NotificationType.REGULAR_ABSENCE_NOTICE &&
            notification.attendanceId &&
            !notification.attendance?.absenceReason
          ? {
              inline_keyboard: [
                [
                  {
                    text:
                      notification.parent?.locale === "uz"
                        ? "🤒 Kasallik"
                        : "🤒 Болезнь",
                    callback_data:
                      "attendance-reason:ILLNESS:" +
                      notification.attendanceId
                  },
                  {
                    text:
                      notification.parent?.locale === "uz"
                        ? "👨‍👩‍👧 Oila"
                        : "👨‍👩‍👧 Семья",
                    callback_data:
                      "attendance-reason:FAMILY:" +
                      notification.attendanceId
                  }
                ],
                [
                  {
                    text:
                      notification.parent?.locale === "uz"
                        ? "✈️ Safar"
                        : "✈️ Поездка",
                    callback_data:
                      "attendance-reason:TRAVEL:" +
                      notification.attendanceId
                  },
                  {
                    text:
                      notification.parent?.locale === "uz"
                        ? "📚 O‘qish"
                        : "📚 Учёба",
                    callback_data:
                      "attendance-reason:SCHOOL:" +
                      notification.attendanceId
                  }
                ],
                [
                  {
                    text:
                      notification.parent?.locale === "uz"
                        ? "Boshqa sabab"
                        : "Другая причина",
                    callback_data:
                      "attendance-reason:OTHER:" +
                      notification.attendanceId
                  }
                ]
              ]
            }
          : undefined;

    const result = await sendTelegramMessage({
      chatId: contact.chatId,
      text,
      replyMarkup
    });

    if (result.ok) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: now,
          attempts: notification.attempts + 1,
          externalMessageId: result.messageId,
          lastError: null
        }
      });
      sent += 1;
    } else {
      const attempts = notification.attempts + 1;

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          attempts,
          status:
            attempts >= 5
              ? NotificationStatus.FAILED
              : NotificationStatus.PENDING,
          lastError: result.error
        }
      });
      failed += 1;
    }
  }

  return {
    processed: due.length,
    sent,
    failed,
    skipped
  };
}
