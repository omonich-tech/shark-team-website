import {
  LeadStatus,
  SessionStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { calculateTrialHoldWindow } from "@/server/trial/calculate-hold-window";

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

    if (
      existing?.status === TrialBookingStatus.HOLD &&
      existing.expiresAt > now
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

    if (existing?.status === TrialBookingStatus.CONFIRMED) {
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
      existing &&
      [
        TrialBookingStatus.ATTENDED,
        TrialBookingStatus.NO_SHOW
      ].includes(existing.status)
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
            status: TrialBookingStatus.HOLD,
            expiresAt: window.expiresAt,
            reminderAt: window.reminderAt,
            reminderSentAt: null,
            confirmedAt: null,
            cancelledAt: null
          }
        })
      : await tx.trialBooking.create({
          data: {
            leadId,
            sessionId,
            status: TrialBookingStatus.HOLD,
            expiresAt: window.expiresAt,
            reminderAt: window.reminderAt
          }
        });

    await tx.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.TRIAL_HELD }
    });

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
