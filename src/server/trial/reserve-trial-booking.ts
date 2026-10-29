import {
  LeadStatus,
  NotificationStatus,
  NotificationType,
  SessionStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { calculateTrialHoldWindow } from "@/server/trial/calculate-hold-window";
import { PriceProductType } from "@/generated/prisma/client";
import { activePriceWhere } from "@/server/public-data/pricing";

export async function reserveTrialBooking(leadId: string) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead || !lead.selectedSessionId) {
      return { ok: false as const, error: "LEAD_NOT_READY" as const };
    }

    const sessionId = lead.selectedSessionId;

    await tx.$queryRaw`
      SELECT "id"
      FROM "TrainingSession"
      WHERE "id" = ${sessionId}
      FOR UPDATE
    `;

    const session = await tx.trainingSession.findUnique({
      where: { id: sessionId }
    });

    if (
      !session ||
      session.status !== SessionStatus.SCHEDULED ||
      session.startsAt <= now ||
      !session.trialBookingEnabled ||
      session.trialCapacity === null ||
      session.trialCapacity <= 0
    ) {
      return { ok: false as const, error: "SESSION_NOT_AVAILABLE" as const };
    }

    // Resolve the group's explicit price while holding the session lock.
    // With no override, the first trial is free and must not enter payment HOLD.
    const trialPrice = await tx.price.findFirst({
      where: {
        ...activePriceWhere(now),
        productType: PriceProductType.TRIAL,
        groupId: session.groupId
      },
      select: { amount: true },
      orderBy: { validFrom: "desc" }
    });
    const isFreeTrial = (trialPrice?.amount ?? 0) === 0;

    await tx.trialBooking.updateMany({
      where: {
        sessionId,
        status: TrialBookingStatus.HOLD,
        expiresAt: { lte: now }
      },
      data: {
        status: TrialBookingStatus.EXPIRED
      }
    });

    const existing = await tx.trialBooking.findUnique({
      where: {
        leadId_sessionId: {
          leadId,
          sessionId
        }
      }
    });

    if (isFreeTrial && existing?.status === TrialBookingStatus.HOLD && existing.expiresAt > now) {
      const booking = await tx.trialBooking.update({
        where: { id: existing.id },
        data: {
          status: TrialBookingStatus.CONFIRMED,
          confirmedAt: now,
          reminderAt: null,
          reminderSentAt: null
        }
      });
      await tx.notification.updateMany({
        where: { trialBookingId: booking.id, type: NotificationType.PAYMENT_HOLD_REMINDER },
        data: { status: NotificationStatus.CANCELLED }
      });
      await tx.lead.update({ where: { id: leadId }, data: { status: LeadStatus.TRIAL_CONFIRMED } });
      return {
        ok: true as const,
        booking: {
          id: booking.id, status: booking.status,
          expiresAt: booking.expiresAt.toISOString(),
          reminderAt: null, sessionId: booking.sessionId
        }
      };
    }

    if (
      existing?.status === TrialBookingStatus.HOLD &&
      existing.expiresAt > now
    ) {
      if (existing.reminderAt) {
        await tx.notification.upsert({
          where: {
            dedupeKey: `trial:${existing.id}:payment-hold-reminder`
          },
          update: {
            scheduledAt: existing.reminderAt,
            status: NotificationStatus.PENDING,
            lastError: null
          },
          create: {
            type: NotificationType.PAYMENT_HOLD_REMINDER,
            leadId,
            trialBookingId: existing.id,
            scheduledAt: existing.reminderAt,
            dedupeKey: `trial:${existing.id}:payment-hold-reminder`
          }
        });
      }

      return {
        ok: true as const,
        booking: {
          id: existing.id,
          status: existing.status,
          expiresAt: existing.expiresAt.toISOString(),
          reminderAt: existing.reminderAt?.toISOString() ?? null,
          sessionId: existing.sessionId
        }
      };
    }

    if (
      existing?.status === TrialBookingStatus.PAYMENT_PENDING ||
      existing?.status === TrialBookingStatus.CONFIRMED
    ) {
      return {
        ok: true as const,
        booking: {
          id: existing.id,
          status: existing.status,
          expiresAt: existing.expiresAt.toISOString(),
          reminderAt: existing.reminderAt?.toISOString() ?? null,
          sessionId: existing.sessionId
        }
      };
    }

    if (
      existing?.status === TrialBookingStatus.ATTENDED ||
      existing?.status === TrialBookingStatus.NO_SHOW
    ) {
      return { ok: false as const, error: "BOOKING_FINALIZED" as const };
    }

    const occupied = await tx.trialBooking.count({
      where: {
        sessionId,
        OR: [
          {
            status: TrialBookingStatus.CONFIRMED
          },
          {
            status: TrialBookingStatus.PAYMENT_PENDING
          },
          {
            status: TrialBookingStatus.HOLD,
            expiresAt: { gt: now }
          }
        ]
      }
    });

    if (occupied >= session.trialCapacity) {
      return { ok: false as const, error: "SLOT_FULL" as const };
    }

    const window = calculateTrialHoldWindow(session.startsAt, now);

    const booking = existing
      ? await tx.trialBooking.update({
          where: { id: existing.id },
          data: {
            status: isFreeTrial ? TrialBookingStatus.CONFIRMED : TrialBookingStatus.HOLD,
            expiresAt: window.expiresAt,
            reminderAt: isFreeTrial ? null : window.reminderAt,
            confirmedAt: isFreeTrial ? now : null,
            reminderSentAt: null,
            confirmedAt: null,
            cancelledAt: null
          }
        })
      : await tx.trialBooking.create({
          data: {
            leadId,
            sessionId,
            status: isFreeTrial ? TrialBookingStatus.CONFIRMED : TrialBookingStatus.HOLD,
            expiresAt: window.expiresAt,
            reminderAt: window.reminderAt
          }
        });

    await tx.lead.update({
      where: { id: leadId },
      data: { status: isFreeTrial ? LeadStatus.TRIAL_CONFIRMED : LeadStatus.TRIAL_HELD }
    });

    if (booking.reminderAt) {
      await tx.notification.upsert({
        where: {
          dedupeKey: `trial:${booking.id}:payment-hold-reminder`
        },
        update: {
          scheduledAt: booking.reminderAt,
          status: NotificationStatus.PENDING,
          lastError: null
        },
        create: {
          type: NotificationType.PAYMENT_HOLD_REMINDER,
          leadId,
          trialBookingId: booking.id,
          scheduledAt: booking.reminderAt,
          dedupeKey: `trial:${booking.id}:payment-hold-reminder`
        }
      });
    }

    return {
      ok: true as const,
      booking: {
        id: booking.id,
        status: booking.status,
        expiresAt: booking.expiresAt.toISOString(),
        reminderAt: booking.reminderAt?.toISOString() ?? null,
        sessionId: booking.sessionId
      }
    };
  });
}
