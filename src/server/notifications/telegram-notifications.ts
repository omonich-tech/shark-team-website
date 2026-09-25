import {
  NotificationStatus,
  NotificationType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/server/telegram/send-message";

function envMinutes(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

async function renderNotification(
  notification: Awaited<
    ReturnType<typeof getPrisma>
  > extends never ? never : any
) {
  const locale: "ru" | "uz" =
    notification.parent?.locale === "uz" ||
    notification.lead?.locale === "uz"
      ? "uz"
      : "ru";

  const booking = notification.trialBooking;
  const childName = notification.lead?.childName ?? "";
  const session = booking?.session;
  const branch = session?.group?.branch;

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
    ? `💬 <b>${childName}</b>ning sinov mashg‘uloti qanday o‘tdi? Taassurotlaringizni shu yerga yozishingiz mumkin.`
    : `💬 Как прошло пробное занятие у <b>${childName}</b>? Напишите впечатления прямо сюда.`;
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
    const result = await sendTelegramMessage({
      chatId: contact.chatId,
      text
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
