import {
  NotificationStatus,
  NotificationType,
  Prisma,
  SessionStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

function envMinutes(name: string, fallback: number) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function eligibleSubscriptionStatuses() {
  return [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAYMENT_DUE,
    SubscriptionStatus.PAST_DUE
  ];
}

async function activeSessionEnrollments(sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      group: {
        include: {
          enrollments: {
            where: {
              status: StudentEnrollmentStatus.ACTIVE,
              OR: [
                { subscriptionStatus: null },
                {
                  subscriptionStatus: {
                    in: eligibleSubscriptionStatuses()
                  }
                }
              ]
            },
            include: {
              child: {
                include: {
                  parent: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!session) return null;

  return {
    session,
    enrollments: session.group.enrollments
  };
}

export async function queueUpcomingRegularSessionReminders(
  now = new Date(),
  horizonHours = 36
) {
  const prisma = getPrisma();
  const reminderMinutes = envMinutes(
    "REGULAR_SESSION_REMINDER_MINUTES",
    180
  );
  const horizon = new Date(
    now.getTime() + horizonHours * 60 * 60 * 1000
  );

  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: SessionStatus.SCHEDULED,
      startsAt: {
        gt: now,
        lte: horizon
      }
    },
    include: {
      group: {
        include: {
          enrollments: {
            where: {
              status: StudentEnrollmentStatus.ACTIVE,
              OR: [
                { subscriptionStatus: null },
                {
                  subscriptionStatus: {
                    in: eligibleSubscriptionStatuses()
                  }
                }
              ]
            },
            include: {
              child: true
            }
          }
        }
      }
    },
    orderBy: { startsAt: "asc" }
  });

  let created = 0;
  let refreshed = 0;
  let preserved = 0;

  for (const session of sessions) {
    const scheduledAtCandidate = new Date(
      session.startsAt.getTime() - reminderMinutes * 60_000
    );
    const scheduledAt =
      scheduledAtCandidate > now ? scheduledAtCandidate : now;

    for (const enrollment of session.group.enrollments) {
      const dedupeKey =
        "regular-session:" +
        session.id +
        ":enrollment:" +
        enrollment.id +
        ":reminder";

      const existing = await prisma.notification.findUnique({
        where: { dedupeKey }
      });

      if (!existing) {
        await prisma.notification.create({
          data: {
            type: NotificationType.REGULAR_SESSION_REMINDER,
            parentId: enrollment.child.parentId,
            enrollmentId: enrollment.id,
            trainingSessionId: session.id,
            scheduledAt,
            dedupeKey
          }
        });
        created += 1;
        continue;
      }

      if (
        existing.status === NotificationStatus.PENDING ||
        existing.status === NotificationStatus.FAILED
      ) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: {
            parentId: enrollment.child.parentId,
            enrollmentId: enrollment.id,
            trainingSessionId: session.id,
            scheduledAt,
            status: NotificationStatus.PENDING,
            attempts: 0,
            lastError: null
          }
        });
        refreshed += 1;
      } else {
        preserved += 1;
      }
    }
  }

  return {
    sessions: sessions.length,
    created,
    refreshed,
    preserved
  };
}

export async function queueRegularSessionCancellation(input: {
  sessionId: string;
  reason?: string | null;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const context = await activeSessionEnrollments(input.sessionId);

  if (!context) {
    return {
      ok: false as const,
      error: "SESSION_NOT_FOUND" as const
    };
  }

  await prisma.notification.updateMany({
    where: {
      trainingSessionId: input.sessionId,
      type: NotificationType.REGULAR_SESSION_REMINDER,
      status: NotificationStatus.PENDING
    },
    data: {
      status: NotificationStatus.SKIPPED,
      lastError: "SESSION_CANCELLED"
    }
  });

  for (const enrollment of context.enrollments) {
    const dedupeKey =
      "regular-session:" +
      input.sessionId +
      ":enrollment:" +
      enrollment.id +
      ":cancelled";

    await prisma.notification.upsert({
      where: { dedupeKey },
      update: {
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        trainingSessionId: input.sessionId,
        scheduledAt: now,
        status: NotificationStatus.PENDING,
        attempts: 0,
        lastError: null,
        contextJson: {
          reason: input.reason?.trim() || null
        } as Prisma.InputJsonValue
      },
      create: {
        type: NotificationType.REGULAR_SESSION_CANCELLED,
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        trainingSessionId: input.sessionId,
        scheduledAt: now,
        dedupeKey,
        contextJson: {
          reason: input.reason?.trim() || null
        } as Prisma.InputJsonValue
      }
    });
  }

  return {
    ok: true as const,
    recipients: context.enrollments.length
  };
}

export async function queueRegularSessionRescheduled(input: {
  sessionId: string;
  oldStartsAt: Date;
  oldEndsAt: Date;
  newStartsAt: Date;
  newEndsAt: Date;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const context = await activeSessionEnrollments(input.sessionId);

  if (!context) {
    return {
      ok: false as const,
      error: "SESSION_NOT_FOUND" as const
    };
  }

  const reminderMinutes = envMinutes(
    "REGULAR_SESSION_REMINDER_MINUTES",
    180
  );
  const newReminderAtCandidate = new Date(
    input.newStartsAt.getTime() - reminderMinutes * 60_000
  );
  const newReminderAt =
    newReminderAtCandidate > now ? newReminderAtCandidate : now;

  await prisma.notification.updateMany({
    where: {
      trainingSessionId: input.sessionId,
      type: NotificationType.REGULAR_SESSION_REMINDER,
      status: NotificationStatus.PENDING
    },
    data: {
      scheduledAt: newReminderAt,
      lastError: null
    }
  });

  const version = input.newStartsAt.getTime();

  for (const enrollment of context.enrollments) {
    const dedupeKey =
      "regular-session:" +
      input.sessionId +
      ":enrollment:" +
      enrollment.id +
      ":rescheduled:" +
      version;

    await prisma.notification.upsert({
      where: { dedupeKey },
      update: {
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        trainingSessionId: input.sessionId,
        scheduledAt: now,
        status: NotificationStatus.PENDING,
        attempts: 0,
        lastError: null,
        contextJson: {
          oldStartsAt: input.oldStartsAt.toISOString(),
          oldEndsAt: input.oldEndsAt.toISOString(),
          newStartsAt: input.newStartsAt.toISOString(),
          newEndsAt: input.newEndsAt.toISOString()
        } as Prisma.InputJsonValue
      },
      create: {
        type: NotificationType.REGULAR_SESSION_RESCHEDULED,
        parentId: enrollment.child.parentId,
        enrollmentId: enrollment.id,
        trainingSessionId: input.sessionId,
        scheduledAt: now,
        dedupeKey,
        contextJson: {
          oldStartsAt: input.oldStartsAt.toISOString(),
          oldEndsAt: input.oldEndsAt.toISOString(),
          newStartsAt: input.newStartsAt.toISOString(),
          newEndsAt: input.newEndsAt.toISOString()
        } as Prisma.InputJsonValue
      }
    });
  }

  return {
    ok: true as const,
    recipients: context.enrollments.length
  };
}
