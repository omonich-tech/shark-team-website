import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  completeParentTrialFeedbackComment,
  skipParentTrialFeedbackComment,
  startParentTrialFeedback
} from "@/server/feedback/trial-feedback";
import {
  reviewSubscriptionPayment,
  submitSubscriptionReceipt
} from "@/server/enrollment/trial-conversion";
import {
  reviewManualCardPayment,
  submitManualCardReceipt
} from "@/server/payments/manual-card";
import { buildTelegramAssistantReply } from "@/server/telegram/assistant";
import { consumeTelegramLinkToken } from "@/server/telegram/link";
import {
  answerTelegramCallbackQuery,
  sendTelegramDocument,
  sendTelegramMessage,
  sendTelegramPhoto
} from "@/server/telegram/send-message";

type TelegramPhoto = {
  file_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
};

type TelegramDocument = {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
  chat?: {
    id?: number;
    type?: string;
  };
  from?: {
    id?: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: {
    id?: string;
    data?: string;
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
    };
    message?: TelegramMessage;
  };
};

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function webhookAuthorized(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get(
    "x-telegram-bot-api-secret-token"
  );

  if (!secret || !received) {
    return false;
  }

  return safeEqual(received, secret);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function adminChatId() {
  const value = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  return value || null;
}

function callbackAllowed(
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const configuredChatId = adminChatId();
  const callbackChatId = callback.message?.chat?.id;

  if (
    !configuredChatId ||
    callbackChatId === undefined ||
    String(callbackChatId) !== configuredChatId
  ) {
    return false;
  }

  const allowedIds = (process.env.TELEGRAM_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedIds.length === 0) {
    return true;
  }

  const userId = callback.from?.id;
  return userId !== undefined && allowedIds.includes(String(userId));
}

function rejectionReason(action: string) {
  if (action === "not_found") return "PAYMENT_NOT_FOUND";
  if (action === "wrong_amount") return "WRONG_AMOUNT";
  if (action === "bad_receipt") return "BAD_RECEIPT";
  return "NOT_VERIFIED";
}

function rejectionText(
  reason: string,
  locale: "ru" | "uz"
) {
  if (locale === "uz") {
    if (reason === "PAYMENT_NOT_FOUND") {
      return "To‘lov topilmadi. Iltimos, o‘tkazmani tekshirib, chekni qayta yuboring.";
    }
    if (reason === "WRONG_AMOUNT") {
      return "To‘lov summasi noto‘g‘ri. Iltimos, administrator bilan bog‘laning.";
    }
    if (reason === "BAD_RECEIPT") {
      return "Chekni o‘qib bo‘lmadi. Iltimos, aniqroq skrinshot yoki surat yuboring.";
    }
    return "To‘lovni tasdiqlab bo‘lmadi. Iltimos, administrator bilan bog‘laning.";
  }

  if (reason === "PAYMENT_NOT_FOUND") {
    return "Платёж не найден. Проверьте перевод и отправьте чек ещё раз.";
  }
  if (reason === "WRONG_AMOUNT") {
    return "Сумма перевода не совпадает. Свяжитесь с администратором.";
  }
  if (reason === "BAD_RECEIPT") {
    return "Чек не удалось прочитать. Отправьте более чёткий скриншот или фотографию.";
  }
  return "Платёж не удалось подтвердить. Свяжитесь с администратором.";
}

async function sendPaymentReviewToAdmin(
  result: Awaited<ReturnType<typeof submitManualCardReceipt>>
) {
  if (!result.ok || result.alreadyPaid) return;

  const chatId = adminChatId();

  if (!chatId) {
    return;
  }

  const booking = result.booking;
  const group = booking.session.group;
  const coach = [group.primaryCoach.firstName, group.primaryCoach.lastName]
    .filter(Boolean)
    .join(" ");

  const caption = [
    "<b>💳 Новая оплата — SHARK TEAM</b>",
    "",
    `Ребёнок: ${escapeHtml(booking.lead.childName)}`,
    `Родитель: ${escapeHtml(booking.lead.parentName)}`,
    `Телефон: ${escapeHtml(booking.lead.phone)}`,
    `Филиал: ${escapeHtml(group.branch.publicNameRu)}`,
    `Направление: ${escapeHtml(group.sport.nameRu)}`,
    `Тренер: ${escapeHtml(coach || "—")}`,
    `Пробное: ${escapeHtml(formatDate(booking.session.startsAt, "ru"))}`,
    `Сумма: <b>${formatMoney(result.payment.amountUzs)} сум</b>`,
    `ID: <code>${escapeHtml(result.payment.id)}</code>`
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "✅ Подтвердить",
          callback_data: `manual:approve:${result.payment.id}`
        }
      ],
      [
        {
          text: "❌ Платёж не найден",
          callback_data: `manual:not_found:${result.payment.id}`
        },
        {
          text: "❌ Неверная сумма",
          callback_data: `manual:wrong_amount:${result.payment.id}`
        }
      ],
      [
        {
          text: "❌ Чек не читается",
          callback_data: `manual:bad_receipt:${result.payment.id}`
        }
      ]
    ]
  };

  const fileId = result.payment.receiptTelegramFileId!;

  if (result.payment.receiptMimeType?.startsWith("document:")) {
    await sendTelegramDocument({
      chatId,
      document: fileId,
      caption,
      replyMarkup
    });
  } else {
    await sendTelegramPhoto({
      chatId,
      photo: fileId,
      caption,
      replyMarkup
    });
  }
}

async function sendSubscriptionPaymentReviewToAdmin(
  result: Awaited<ReturnType<typeof submitSubscriptionReceipt>>
) {
  if (!result.ok || result.alreadyPaid) return;

  const chatId = adminChatId();
  if (!chatId) return;

  const conversion = result.conversion;
  const group = conversion.group;
  const coach = [group.primaryCoach.firstName, group.primaryCoach.lastName]
    .filter(Boolean)
    .join(" ");

  const caption = [
    "<b>💳 Оплата абонемента — SHARK TEAM</b>",
    "",
    "Ребёнок: " + escapeHtml(conversion.child.name),
    "Родитель: " + escapeHtml(conversion.child.parent.name),
    "Телефон: " + escapeHtml(conversion.child.parent.phone),
    "Филиал: " + escapeHtml(group.branch.publicNameRu),
    "Направление: " + escapeHtml(group.sport.nameRu),
    "Группа: " + escapeHtml(group.internalName),
    "Тренер: " + escapeHtml(coach || "—"),
    "Сумма: <b>" + formatMoney(result.payment.amountUzs) + " сум</b>",
    "ID: <code>" + escapeHtml(result.payment.id) + "</code>"
  ].join("\n");

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "✅ Подтвердить абонемент",
          callback_data: "subscription:approve:" + result.payment.id
        }
      ],
      [
        {
          text: "❌ Платёж не найден",
          callback_data: "subscription:not_found:" + result.payment.id
        },
        {
          text: "❌ Неверная сумма",
          callback_data: "subscription:wrong_amount:" + result.payment.id
        }
      ],
      [
        {
          text: "❌ Чек не читается",
          callback_data: "subscription:bad_receipt:" + result.payment.id
        }
      ]
    ]
  };

  const fileId = result.payment.receiptTelegramFileId;
  if (!fileId) return;

  if (result.payment.receiptMimeType?.startsWith("document:")) {
    await sendTelegramDocument({
      chatId,
      document: fileId,
      caption,
      replyMarkup
    });
  } else {
    await sendTelegramPhoto({
      chatId,
      photo: fileId,
      caption,
      replyMarkup
    });
  }
}

async function handleFeedbackCallback(
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const callbackId = callback.id;
  const data = callback.data ?? "";
  const telegramUserId = callback.from?.id;
  const chatId = callback.message?.chat?.id;

  if (!callbackId || !telegramUserId) {
    return false;
  }

  if (data.startsWith("feedback-skip:")) {
    const bookingId = data.slice("feedback-skip:".length);

    if (!bookingId) {
      return false;
    }

    const result = await skipParentTrialFeedbackComment({
      telegramUserId: BigInt(telegramUserId),
      trialBookingId: bookingId
    });

    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text: result.ok ? "Спасибо за обратную связь." : "Не удалось сохранить."
    });

    if (result.ok && chatId !== undefined) {
      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text:
          result.locale === "uz"
            ? "✅ Rahmat. Fikringiz saqlandi."
            : "✅ Спасибо. Ваш отзыв сохранён."
      });
    }

    return true;
  }

  if (!data.startsWith("feedback:")) {
    return false;
  }

  const [, ratingRaw, bookingId] = data.split(":");
  const rating = Number(ratingRaw);

  if (!bookingId || !Number.isInteger(rating)) {
    return false;
  }

  const result = await startParentTrialFeedback({
    telegramUserId: BigInt(telegramUserId),
    trialBookingId: bookingId,
    rating
  });

  await answerTelegramCallbackQuery({
    callbackQueryId: callbackId,
    text: result.ok ? "Оценка сохранена." : "Не удалось сохранить оценку."
  });

  if (result.ok && chatId !== undefined) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        result.locale === "uz"
          ? "Rahmat. Endi xohlasangiz bir xabarda taassurotingizni yozing: nimalar yoqdi yoki nimani yaxshilash kerak?"
          : "Спасибо. Теперь при желании напишите одним сообщением: что понравилось и что можно улучшить?",
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text:
                result.locale === "uz"
                  ? "Izohsiz yakunlash"
                  : "Без комментария",
              callback_data: "feedback-skip:" + bookingId
            }
          ]
        ]
      }
    });
  }

  return true;
}

async function handleSubscriptionPaymentCallback(
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const callbackId = callback.id;
  const data = callback.data ?? "";

  if (!callbackId || !data.startsWith("subscription:")) {
    return false;
  }

  if (!callbackAllowed(callback)) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text: "Нет доступа.",
      showAlert: true
    });
    return true;
  }

  const parts = data.split(":");
  const action = parts[1];
  const paymentId = parts[2];

  if (!action || !paymentId) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text: "Некорректная команда.",
      showAlert: true
    });
    return true;
  }

  const approve = action === "approve";
  const reason = approve ? null : rejectionReason(action);
  const reviewedBy = callback.from?.id
    ? "telegram:" + callback.from.id
    : "telegram:unknown";

  const result = await reviewSubscriptionPayment({
    paymentId,
    approve,
    reviewedBy,
    rejectionReason: reason
  });

  if (!result.ok) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text:
        result.error === "GROUP_FULL"
          ? "Группа заполнена. Оплату нельзя подтвердить до решения администратора."
          : result.error === "PAYMENT_NOT_UNDER_REVIEW"
            ? "Оплата уже обработана или не ожидает проверки."
            : "Не удалось обработать оплату.",
      showAlert: true
    });
    return true;
  }

  await answerTelegramCallbackQuery({
    callbackQueryId: callbackId,
    text: result.approved
      ? "Абонемент подтверждён."
      : "Оплата абонемента отклонена."
  });

  if (result.alreadyProcessed) {
    return true;
  }

  const prisma = getPrisma();
  const conversion = result.conversion;
  const contact = await prisma.telegramContact.findFirst({
    where: {
      parentId: conversion.child.parentId
    },
    orderBy: {
      verifiedAt: "desc"
    }
  });

  const locale: "ru" | "uz" =
    contact?.locale === "uz" ? "uz" : "ru";

  if (contact) {
    if (result.approved) {
      const group = conversion.group;
      const coach = [
        group.primaryCoach.firstName,
        group.primaryCoach.lastName
      ]
        .filter(Boolean)
        .join(" ");

      const text =
        locale === "uz"
          ? [
              "✅ <b>Abonement to‘lovi tasdiqlandi</b>",
              "",
              "Bola: " + escapeHtml(conversion.child.name),
              "Guruh: " + escapeHtml(group.internalName),
              "Filial: " + escapeHtml(group.branch.publicNameUz),
              "Sport: " + escapeHtml(group.sport.nameUz),
              "Murabbiy: " + escapeHtml(coach || "—"),
              "",
              "Bola guruhga doimiy o‘quvchi sifatida qo‘shildi."
            ].join("\n")
          : [
              "✅ <b>Оплата абонемента подтверждена</b>",
              "",
              "Ребёнок: " + escapeHtml(conversion.child.name),
              "Группа: " + escapeHtml(group.internalName),
              "Филиал: " + escapeHtml(group.branch.publicNameRu),
              "Направление: " + escapeHtml(group.sport.nameRu),
              "Тренер: " + escapeHtml(coach || "—"),
              "",
              "Ребёнок зачислен в группу как постоянный ученик."
            ].join("\n");

      await sendTelegramMessage({
        chatId: contact.chatId,
        text
      });
    } else {
      await sendTelegramMessage({
        chatId: contact.chatId,
        text: rejectionText(reason ?? "NOT_VERIFIED", locale)
      });
    }
  }

  const chatId = adminChatId();
  if (chatId) {
    await sendTelegramMessage({
      chatId,
      text: result.approved
        ? "✅ Абонемент <code>" +
          escapeHtml(paymentId) +
          "</code> подтверждён. Ребёнок зачислен в группу."
        : "❌ Оплата абонемента <code>" +
          escapeHtml(paymentId) +
          "</code> отклонена: " +
          escapeHtml(reason ?? "NOT_VERIFIED") +
          "."
    });
  }

  return true;
}

async function handlePaymentCallback(
  callback: NonNullable<TelegramUpdate["callback_query"]>
) {
  const callbackId = callback.id;
  const data = callback.data ?? "";

  if (!callbackId || !data.startsWith("manual:")) {
    return false;
  }

  if (!callbackAllowed(callback)) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text: "Нет доступа.",
      showAlert: true
    });
    return true;
  }

  const [, action, paymentId] = data.split(":");

  if (!action || !paymentId) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text: "Некорректная команда.",
      showAlert: true
    });
    return true;
  }

  const approve = action === "approve";
  const reason = approve ? null : rejectionReason(action);
  const reviewedBy = callback.from?.id
    ? `telegram:${callback.from.id}`
    : "telegram:unknown";

  const result = await reviewManualCardPayment({
    paymentId,
    approve,
    reviewedBy,
    rejectionReason: reason
  });

  if (!result.ok) {
    await answerTelegramCallbackQuery({
      callbackQueryId: callbackId,
      text:
        result.error === "PAYMENT_NOT_UNDER_REVIEW"
          ? "Оплата уже обработана или не ожидает проверки."
          : "Не удалось обработать оплату.",
      showAlert: true
    });
    return true;
  }

  await answerTelegramCallbackQuery({
    callbackQueryId: callbackId,
    text: result.approved
      ? "Оплата подтверждена."
      : "Оплата отклонена."
  });

  if (result.alreadyProcessed) {
    return true;
  }

  const prisma = getPrisma();
  const lead = result.booking.lead;
  const contact = await prisma.telegramContact.findFirst({
    where: {
      OR: [
        { leadId: lead.id },
        ...(lead.parentId ? [{ parentId: lead.parentId }] : [])
      ]
    },
    orderBy: {
      verifiedAt: "desc"
    }
  });

  const locale: "ru" | "uz" =
    contact?.locale === "uz" ? "uz" : "ru";

  if (contact) {
    if (result.approved) {
      const group = result.booking.session.group;
      const coach = [
        group.primaryCoach.firstName,
        group.primaryCoach.lastName
      ]
        .filter(Boolean)
        .join(" ");

      const text =
        locale === "uz"
          ? [
              "✅ <b>To‘lov tasdiqlandi</b>",
              "",
              `Bola: ${escapeHtml(lead.childName)}`,
              `Sinov: ${escapeHtml(formatDate(result.booking.session.startsAt, locale))}`,
              `Filial: ${escapeHtml(group.branch.publicNameUz)}`,
              `Sport: ${escapeHtml(group.sport.nameUz)}`,
              `Murabbiy: ${escapeHtml(coach || "—")}`,
              "",
              "Sinov mashg‘ulotingiz tasdiqlandi."
            ].join("\n")
          : [
              "✅ <b>Оплата подтверждена</b>",
              "",
              `Ребёнок: ${escapeHtml(lead.childName)}`,
              `Пробное: ${escapeHtml(formatDate(result.booking.session.startsAt, locale))}`,
              `Филиал: ${escapeHtml(group.branch.publicNameRu)}`,
              `Направление: ${escapeHtml(group.sport.nameRu)}`,
              `Тренер: ${escapeHtml(coach || "—")}`,
              "",
              "Запись на пробное занятие подтверждена."
            ].join("\n");

      await sendTelegramMessage({
        chatId: contact.chatId,
        text
      });
    } else {
      await sendTelegramMessage({
        chatId: contact.chatId,
        text: rejectionText(reason ?? "NOT_VERIFIED", locale)
      });
    }
  }

  const chatId = adminChatId();
  if (chatId) {
    await sendTelegramMessage({
      chatId,
      text: result.approved
        ? `✅ Оплата <code>${escapeHtml(paymentId)}</code> подтверждена.`
        : `❌ Оплата <code>${escapeHtml(paymentId)}</code> отклонена: ${escapeHtml(reason ?? "NOT_VERIFIED")}.`
    });
  }

  return true;
}

export async function POST(request: NextRequest) {
  if (!webhookAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let update: TelegramUpdate;

  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (update.callback_query) {
    const feedbackHandled = await handleFeedbackCallback(
      update.callback_query
    );

    if (!feedbackHandled) {
      await handlePaymentCallback(update.callback_query);
    }

    return NextResponse.json({ ok: true });
  }

  const message = update.message;

  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const text = message.text?.trim();
  const chatId = message.chat?.id;
  const telegramUserId = message.from?.id;

  if (chatId === undefined || telegramUserId === undefined) {
    return NextResponse.json({ ok: true });
  }

  if (text && /^\/id(?:@[A-Za-z0-9_]+)?$/.test(text)) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text: `Chat ID: <code>${chatId}</code>\nUser ID: <code>${telegramUserId}</code>`
    });

    return NextResponse.json({ ok: true });
  }

  if (message.chat?.type && message.chat.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  if (text?.startsWith("/start link_")) {
    const token = text.slice("/start link_".length).trim();

    const result = await consumeTelegramLinkToken({
      token,
      telegramUserId: BigInt(telegramUserId),
      chatId: BigInt(chatId),
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
      languageCode: message.from?.language_code ?? null
    });

    if (result.ok) {
      const greeting =
        result.contact.locale === "uz"
          ? "✅ Telegram SHARK TEAM arizangizga ulandi. Agar kartaga to‘lov qilgan bo‘lsangiz, chek yoki skrinshotni shu chatga yuboring."
          : "✅ Telegram подключён к вашей заявке SHARK TEAM. Если вы уже перевели оплату на карту, отправьте сюда фото или скриншот чека.";

      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text: greeting
      });
    } else {
      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text:
          "Ссылка недействительна или уже истекла. Получите новую персональную ссылку на сайте SHARK TEAM."
      });
    }

    return NextResponse.json({ ok: true });
  }

  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: BigInt(telegramUserId)
    }
  });

  if (!contact) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        "Сначала подключите Telegram через персональную ссылку после записи на пробное занятие."
    });

    return NextResponse.json({ ok: true });
  }

  await prisma.telegramContact.update({
    where: { id: contact.id },
    data: {
      chatId: BigInt(chatId),
      username: message.from?.username ?? contact.username,
      firstName: message.from?.first_name ?? contact.firstName,
      languageCode:
        message.from?.language_code ?? contact.languageCode,
      lastMessageAt: new Date()
    }
  });

  const photos = message.photo ?? [];
  const document = message.document;
  const documentMimeType = document?.mime_type ?? "";
  const documentIsReceipt =
    Boolean(document?.file_id) &&
    (documentMimeType === "application/pdf" ||
      documentMimeType.startsWith("image/"));

  if (photos.length > 0 || documentIsReceipt) {
    if (!adminChatId()) {
      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text:
          contact.locale === "uz"
            ? "To‘lovni tekshirish hozircha sozlanmagan. Administrator bilan bog‘laning."
            : "Проверка оплаты пока не настроена. Свяжитесь с администратором."
      });
      return NextResponse.json({ ok: true });
    }

    const photo = photos.at(-1);
    const fileId = photo?.file_id ?? document?.file_id;
    const receiptMimeType = photo
      ? "photo:image/jpeg"
      : `document:${documentMimeType || "application/octet-stream"}`;
    const receiptSize = photo?.file_size ?? document?.file_size ?? null;

    if (!fileId) {
      return NextResponse.json({ ok: true });
    }

    const result = await submitManualCardReceipt({
      telegramUserId: BigInt(telegramUserId),
      telegramFileId: fileId,
      receiptMimeType,
      receiptSize
    });

    if (!result.ok) {
      const locale = contact.locale === "uz" ? "uz" : "ru";
      const errorText =
        result.error === "BOOKING_EXPIRED"
          ? locale === "uz"
            ? "Bron muddati tugagan. Iltimos, sinov mashg‘ulotiga qayta yoziling."
            : "Срок брони истёк. Оформите запись на пробное заново."
          : locale === "uz"
            ? "Bu ariza uchun kartaga to‘lov topilmadi. Administrator bilan bog‘laning."
            : "Для этой заявки не найдена оплата на карту. Свяжитесь с администратором.";

      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text: errorText
      });

      return NextResponse.json({ ok: true });
    }

    if (result.alreadyPaid) {
      await sendTelegramMessage({
        chatId: BigInt(chatId),
        text:
          contact.locale === "uz"
            ? "✅ Bu to‘lov allaqachon tasdiqlangan."
            : "✅ Эта оплата уже подтверждена."
      });
      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        contact.locale === "uz"
          ? "✅ Chek qabul qilindi va administrator tekshiruviga yuborildi. Tekshiruv tugashi bilan shu yerda xabar beramiz."
          : "✅ Чек получен и отправлен администратору на проверку. После проверки мы сообщим результат здесь."
    });

    await sendPaymentReviewToAdmin(result);

    return NextResponse.json({ ok: true });
  }

  if (document?.file_id) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        contact.locale === "uz"
          ? "Chekni PDF, rasm yoki skrinshot ko‘rinishida yuboring."
          : "Отправьте чек в формате PDF, изображения или скриншота."
    });

    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const feedback = await completeParentTrialFeedbackComment({
    telegramUserId: BigInt(telegramUserId),
    comment: text
  });

  if (feedback.ok) {
    await sendTelegramMessage({
      chatId: BigInt(chatId),
      text:
        feedback.locale === "uz"
          ? "✅ Rahmat. Fikringiz saqlandi. Administrator va murabbiy natijalarni ko‘rib chiqadi."
          : "✅ Спасибо. Ваш отзыв сохранён. Администратор увидит его вместе с оценкой тренера."
    });

    return NextResponse.json({ ok: true });
  }

  const reply = await buildTelegramAssistantReply(
    BigInt(telegramUserId),
    text
  );

  await sendTelegramMessage({
    chatId: BigInt(chatId),
    text: reply
  });

  return NextResponse.json({ ok: true });
}
