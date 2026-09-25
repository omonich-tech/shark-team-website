import {
  LifecycleStatus,
  PriceProductType,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

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

function includesAny(text: string, variants: string[]) {
  return variants.some((variant) => text.includes(variant));
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const output = (payload as { output?: unknown }).output;

  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "output_text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

export async function buildTelegramAssistantReply(
  telegramUserId: bigint,
  rawText: string
) {
  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: { telegramUserId },
    include: {
      lead: true,
      parent: true
    }
  });

  if (!contact) {
    return "Сначала подключите Telegram через персональную ссылку на сайте SHARK TEAM.";
  }

  const locale: "ru" | "uz" = contact.locale === "uz" ? "uz" : "ru";
  const text = rawText.trim().toLowerCase();
  const leadIds = contact.leadId ? [contact.leadId] : [];

  if (contact.parentId) {
    const parentLeads = await prisma.lead.findMany({
      where: { parentId: contact.parentId },
      select: { id: true }
    });
    leadIds.push(...parentLeads.map((lead) => lead.id));
  }

  const upcomingTrial = await prisma.trialBooking.findFirst({
    where: {
      leadId: { in: Array.from(new Set(leadIds)) },
      status: {
        in: [
          TrialBookingStatus.HOLD,
          TrialBookingStatus.PAYMENT_PENDING,
          TrialBookingStatus.CONFIRMED
        ]
      },
      session: {
        startsAt: { gt: new Date() }
      }
    },
    include: {
      lead: true,
      payment: true,
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
    },
    orderBy: {
      session: {
        startsAt: "asc"
      }
    }
  });

  const branch = await prisma.branch.findUnique({
    where: { id: "BR-SCHOOL-117-01" }
  });

  const prices = await prisma.price.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      branchId: "BR-SCHOOL-117-01",
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
    }
  });

  const trialPrice = prices.find(
    (price) => price.productType === PriceProductType.TRIAL
  );
  const subscriptionPrice = prices.find(
    (price) => price.productType === PriceProductType.SUBSCRIPTION
  );

  if (
    includesAny(text, [
      "цена",
      "стоимость",
      "сколько",
      "narx",
      "qancha",
      "to'lov",
      "to‘lov"
    ])
  ) {
    return locale === "uz"
      ? `Sinov mashg‘uloti: ${trialPrice ? formatMoney(trialPrice.amount) : "—"} UZS. Oylik abonement: ${subscriptionPrice ? formatMoney(subscriptionPrice.amount) : "—"} UZS.`
      : `Пробное занятие: ${trialPrice ? formatMoney(trialPrice.amount) : "—"} UZS. Абонемент: ${subscriptionPrice ? formatMoney(subscriptionPrice.amount) : "—"} UZS в месяц.`;
  }

  if (
    includesAny(text, [
      "адрес",
      "где",
      "локац",
      "manzil",
      "qayer",
      "metro"
    ])
  ) {
    return locale === "uz"
      ? `${branch?.publicNameUz ?? "SHARK TEAM"}: ${branch?.addressUz ?? ""}. Mo‘ljal: ${branch?.landmarkUz ?? ""}.`
      : `${branch?.publicNameRu ?? "SHARK TEAM"}: ${branch?.addressRu ?? ""}. Ориентир: ${branch?.landmarkRu ?? ""}.`;
  }

  if (
    includesAny(text, [
      "распис",
      "когда",
      "время",
      "jadval",
      "qachon",
      "vaqt"
    ])
  ) {
    const groups = await prisma.trainingGroup.findMany({
      where: {
        branchId: "BR-SCHOOL-117-01",
        status: LifecycleStatus.ACTIVE
      },
      include: {
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE }
        }
      },
      orderBy: { ageMin: "asc" }
    });

    const lines = groups.map((group) => {
      const first = group.scheduleRules[0];
      const start = first
        ? `${String(Math.floor(first.startMinutes / 60)).padStart(2, "0")}:${String(first.startMinutes % 60).padStart(2, "0")}`
        : "—";
      const end = first
        ? `${String(Math.floor(first.endMinutes / 60)).padStart(2, "0")}:${String(first.endMinutes % 60).padStart(2, "0")}`
        : "—";

      return `${group.ageMin}–${group.ageMax}: ${start}–${end}`;
    });

    return locale === "uz"
      ? `Mashg‘ulotlar seshanba / payshanba / shanba:\n${lines.join("\n")}`
      : `Занятия во вторник / четверг / субботу:\n${lines.join("\n")}`;
  }

  if (
    includesAny(text, [
      "пробн",
      "бронь",
      "оплат",
      "статус",
      "sinov",
      "bron",
      "holat"
    ]) &&
    upcomingTrial
  ) {
    const date = formatDate(upcomingTrial.session.startsAt, locale);
    const bookingStatus = upcomingTrial.status;
    const paymentStatus = upcomingTrial.payment?.status ?? "—";

    return locale === "uz"
      ? `Sinov: ${upcomingTrial.lead.childName}, ${date}. Bron holati: ${bookingStatus}. To‘lov: ${paymentStatus}.`
      : `Пробное: ${upcomingTrial.lead.childName}, ${date}. Статус брони: ${bookingStatus}. Оплата: ${paymentStatus}.`;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return locale === "uz"
      ? "Men jadval, narx, manzil va sinov holati bo‘yicha yordam bera olaman. Murakkab savol bo‘lsa, administratorga yuboraman."
      : "Я могу подсказать расписание, цены, адрес и статус пробного. Если вопрос требует администратора, я передам его дальше.";
  }

  const context = {
    locale,
    branch: branch
      ? {
          name:
            locale === "uz" ? branch.publicNameUz : branch.publicNameRu,
          address: locale === "uz" ? branch.addressUz : branch.addressRu,
          landmark:
            locale === "uz" ? branch.landmarkUz : branch.landmarkRu
        }
      : null,
    trialPrice: trialPrice?.amount ?? null,
    subscriptionPrice: subscriptionPrice?.amount ?? null,
    upcomingTrial: upcomingTrial
      ? {
          child: upcomingTrial.lead.childName,
          startsAt: upcomingTrial.session.startsAt.toISOString(),
          bookingStatus: upcomingTrial.status,
          paymentStatus: upcomingTrial.payment?.status ?? null
        }
      : null
  };

  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are the SHARK TEAM Telegram assistant for parents. Reply in the user's selected language (Russian or Uzbek). Use only the supplied live context for prices, schedule, branch and booking facts. Never invent missing facts. Keep replies concise. Do not make medical diagnoses or give health clearance. For complaints, refunds, discounts, legal questions, or facts not in context, say an administrator needs to handle it.",
      input: `Live context:\n${JSON.stringify(context)}\n\nParent message:\n${rawText}`
    })
  });

  if (!response.ok) {
    return locale === "uz"
      ? "Hozir bu savolga avtomatik javob bera olmadim. Administrator bilan bog‘lanish kerak."
      : "Сейчас не получилось ответить автоматически. Этот вопрос нужно передать администратору.";
  }

  const payload = await response.json();
  const answer = extractResponseText(payload);

  return (
    answer ??
    (locale === "uz"
      ? "Bu savolni administratorga yuborish kerak."
      : "Этот вопрос нужно передать администратору.")
  );
}
