import { createHash, randomBytes } from "node:crypto";
import {
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

let cachedBotUsername: string | null | undefined;

async function resolveBotUsername() {
  if (cachedBotUsername !== undefined) {
    return cachedBotUsername;
  }

  const configured =
    process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");

  if (configured) {
    cachedBotUsername = configured;
    return configured;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

  if (!token) {
    cachedBotUsername = null;
    return null;
  }

  try {
    const apiBase =
      process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";
    const response = await fetch(`${apiBase}/bot${token}/getMe`, {
      cache: "no-store"
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: {
        username?: string;
      };
    };

    const username = payload.result?.username?.trim().replace(/^@/, "") ?? "";

    if (!response.ok || payload.ok !== true || !username) {
      cachedBotUsername = null;
      return null;
    }

    cachedBotUsername = username;
    return username;
  } catch {
    cachedBotUsername = null;
    return null;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createTelegramLinkForBooking(bookingId: string) {
  const botUsername = await resolveBotUsername();

  if (!botUsername) {
    return {
      ok: false as const,
      error: "TELEGRAM_NOT_CONFIGURED" as const
    };
  }

  const prisma = getPrisma();

  const booking = await prisma.trialBooking.findUnique({
    where: { id: bookingId },
    include: {
      lead: true
    }
  });

  if (!booking) {
    return {
      ok: false as const,
      error: "BOOKING_NOT_FOUND" as const
    };
  }

  if (
    booking.status === TrialBookingStatus.EXPIRED ||
    booking.status === TrialBookingStatus.CANCELLED
  ) {
    return {
      ok: false as const,
      error: "BOOKING_NOT_ACTIVE" as const
    };
  }

  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(rawToken);

  await prisma.telegramLinkToken.create({
    data: {
      tokenHash,
      leadId: booking.leadId,
      expiresAt: new Date(Date.now() + LINK_TTL_MS)
    }
  });

  return {
    ok: true as const,
    deepLink: `https://t.me/${botUsername}?start=link_${rawToken}`
  };
}

export async function consumeTelegramLinkToken(input: {
  token: string;
  telegramUserId: bigint;
  chatId: bigint;
  username?: string | null;
  firstName?: string | null;
  languageCode?: string | null;
}) {
  const prisma = getPrisma();
  const tokenHash = hashToken(input.token);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const link = await tx.telegramLinkToken.findUnique({
      where: { tokenHash },
      include: {
        lead: true
      }
    });

    if (!link || link.usedAt || link.expiresAt <= now) {
      return {
        ok: false as const,
        error: "LINK_INVALID_OR_EXPIRED" as const
      };
    }

    const contact = await tx.telegramContact.upsert({
      where: {
        telegramUserId: input.telegramUserId
      },
      update: {
        leadId: link.leadId,
        parentId: link.lead.parentId,
        chatId: input.chatId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        languageCode: input.languageCode ?? null,
        locale: link.lead.locale === "uz" ? "uz" : "ru",
        verifiedAt: now,
        lastMessageAt: now
      },
      create: {
        leadId: link.leadId,
        parentId: link.lead.parentId,
        telegramUserId: input.telegramUserId,
        chatId: input.chatId,
        username: input.username ?? null,
        firstName: input.firstName ?? null,
        languageCode: input.languageCode ?? null,
        locale: link.lead.locale === "uz" ? "uz" : "ru",
        verifiedAt: now,
        lastMessageAt: now
      }
    });

    await tx.telegramLinkToken.update({
      where: { id: link.id },
      data: {
        usedAt: now
      }
    });

    return {
      ok: true as const,
      contact
    };
  });
}
