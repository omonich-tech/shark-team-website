import { createHash, randomBytes } from "node:crypto";
import {
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createTelegramLinkForBooking(bookingId: string) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");

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
