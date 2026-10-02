import {
  SessionStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  queueRegularSessionCancellation,
  queueRegularSessionRescheduled
} from "@/server/notifications/regular-session-notifications";

const ACTIVE_TRIAL_STATUSES: TrialBookingStatus[] = [
  TrialBookingStatus.HOLD,
  TrialBookingStatus.PAYMENT_PENDING,
  TrialBookingStatus.CONFIRMED
];

export async function cancelRegularTrainingSession(input: {
  sessionId: string;
  reason?: string | null;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const session = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId },
    include: {
      trialBookings: {
        where: {
          status: { in: ACTIVE_TRIAL_STATUSES }
        },
        select: { id: true }
      }
    }
  });

  if (!session) {
    return { ok: false as const, error: "SESSION_NOT_FOUND" as const };
  }

  if (
    session.status !== SessionStatus.SCHEDULED ||
    session.startsAt <= now
  ) {
    return {
      ok: false as const,
      error: "SESSION_NOT_EDITABLE" as const
    };
  }

  if (session.trialBookings.length > 0) {
    return {
      ok: false as const,
      error: "SESSION_HAS_ACTIVE_TRIAL_BOOKINGS" as const,
      count: session.trialBookings.length
    };
  }

  const reason = input.reason?.trim().slice(0, 500) || null;

  const updated = await prisma.trainingSession.update({
    where: { id: session.id },
    data: {
      status: SessionStatus.CANCELLED,
      cancellationReason: reason
    }
  });

  const notifications = await queueRegularSessionCancellation({
    sessionId: session.id,
    reason,
    now
  });

  return {
    ok: true as const,
    before: session,
    session: updated,
    notifications
  };
}

export async function rescheduleRegularTrainingSession(input: {
  sessionId: string;
  startsAt: Date;
  endsAt: Date;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  if (
    Number.isNaN(input.startsAt.getTime()) ||
    Number.isNaN(input.endsAt.getTime()) ||
    input.startsAt <= now ||
    input.endsAt <= input.startsAt
  ) {
    return {
      ok: false as const,
      error: "INVALID_SESSION_TIME" as const
    };
  }

  const session = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId },
    include: {
      trialBookings: {
        where: {
          status: { in: ACTIVE_TRIAL_STATUSES }
        },
        select: { id: true }
      }
    }
  });

  if (!session) {
    return { ok: false as const, error: "SESSION_NOT_FOUND" as const };
  }

  if (
    session.status !== SessionStatus.SCHEDULED ||
    session.startsAt <= now
  ) {
    return {
      ok: false as const,
      error: "SESSION_NOT_EDITABLE" as const
    };
  }

  if (session.trialBookings.length > 0) {
    return {
      ok: false as const,
      error: "SESSION_HAS_ACTIVE_TRIAL_BOOKINGS" as const,
      count: session.trialBookings.length
    };
  }

  const conflict = await prisma.trainingSession.findFirst({
    where: {
      id: { not: session.id },
      groupId: session.groupId,
      startsAt: input.startsAt
    },
    select: { id: true }
  });

  if (conflict) {
    return {
      ok: false as const,
      error: "SESSION_TIME_CONFLICT" as const
    };
  }

  const oldStartsAt = session.startsAt;
  const oldEndsAt = session.endsAt;

  const updated = await prisma.trainingSession.update({
    where: { id: session.id },
    data: {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      cancellationReason: null
    }
  });

  const notifications = await queueRegularSessionRescheduled({
    sessionId: session.id,
    oldStartsAt,
    oldEndsAt,
    newStartsAt: updated.startsAt,
    newEndsAt: updated.endsAt,
    now
  });

  return {
    ok: true as const,
    before: session,
    session: updated,
    notifications
  };
}
