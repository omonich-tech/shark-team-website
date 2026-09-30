import {
  NotificationStatus,
  NotificationType,
  Prisma,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
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
      subscriptionPayment: true
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
