import {
  AttendanceStatus,
  SessionStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const participantInclude = {
  group: {
    include: {
      branch: true,
      sport: true,
      enrollments: {
        where: {
          status: StudentEnrollmentStatus.ACTIVE,
          OR: [
            { subscriptionStatus: null },
            {
              subscriptionStatus: {
                not: SubscriptionStatus.FROZEN
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
  },
  coach: true,
  trialBookings: {
    where: {
      status: {
        in: [
          TrialBookingStatus.CONFIRMED,
          TrialBookingStatus.ATTENDED,
          TrialBookingStatus.NO_SHOW
        ]
      },
      lead: {
        childId: {
          not: null
        }
      }
    },
    include: {
      lead: {
        include: {
          child: {
            include: {
              parent: true
            }
          }
        }
      },
      assessment: true
    }
  },
  attendances: true
} as const;

export type AdminSessionRow = Awaited<
  ReturnType<typeof getAdminSessions>
>[number];

function buildParticipants(
  session: Awaited<ReturnType<typeof getAdminSessionById>>
) {
  if (!session) return [];

  const attendanceByChild = new Map(
    session.attendances.map((attendance) => [
      attendance.childId,
      attendance
    ])
  );

  const participants = new Map<
    string,
    {
      childId: string;
      childName: string;
      parentName: string;
      parentPhone: string;
      source: "REGULAR" | "TRIAL";
      trialBookingId: string | null;
      trialStatus: string | null;
      assessmentCompleted: boolean;
      attendanceStatus: string | null;
      absenceReason: string | null;
      absenceNote: string | null;
    }
  >();

  for (const enrollment of session.group.enrollments) {
    if (enrollment.startDate > session.startsAt) continue;
    if (enrollment.endDate && enrollment.endDate < session.startsAt) {
      continue;
    }

    const attendance = attendanceByChild.get(enrollment.childId);

    participants.set(enrollment.childId, {
      childId: enrollment.childId,
      childName: enrollment.child.name,
      parentName: enrollment.child.parent.name,
      parentPhone: enrollment.child.parent.phone,
      source: "REGULAR",
      trialBookingId: null,
      trialStatus: null,
      assessmentCompleted: false,
      attendanceStatus: attendance?.status ?? null,
      absenceReason: attendance?.absenceReason ?? null,
      absenceNote: attendance?.absenceNote ?? null
    });
  }

  for (const booking of session.trialBookings) {
    const child = booking.lead.child;
    if (!child) continue;

    const attendance = attendanceByChild.get(child.id);

    participants.set(child.id, {
      childId: child.id,
      childName: child.name,
      parentName: child.parent.name,
      parentPhone: child.parent.phone,
      source: "TRIAL",
      trialBookingId: booking.id,
      trialStatus: booking.status,
      assessmentCompleted: Boolean(booking.assessment),
      attendanceStatus: attendance?.status ?? null,
      absenceReason: attendance?.absenceReason ?? null,
      absenceNote: attendance?.absenceNote ?? null
    });
  }

  return Array.from(participants.values()).sort((a, b) =>
    a.childName.localeCompare(b.childName, "ru")
  );
}

function summarizeSession(
  session: NonNullable<Awaited<ReturnType<typeof getAdminSessionById>>>,
  now: Date
) {
  const participants = buildParticipants(session);
  const marked = participants.filter((item) => item.attendanceStatus);
  const present = marked.filter(
    (item) => item.attendanceStatus === AttendanceStatus.PRESENT
  ).length;
  const absent = marked.filter(
    (item) => item.attendanceStatus === AttendanceStatus.ABSENT
  ).length;
  const excused = marked.filter(
    (item) => item.attendanceStatus === AttendanceStatus.EXCUSED
  ).length;
  const trials = participants.filter(
    (item) => item.source === "TRIAL"
  ).length;

  const operationalState =
    session.status === SessionStatus.COMPLETED
      ? "COMPLETED"
      : session.status === SessionStatus.CANCELLED
        ? "CANCELLED"
        : session.endsAt < now
          ? "OVERDUE"
          : session.startsAt <= now
            ? "IN_PROGRESS"
            : "UPCOMING";

  return {
    participants,
    expected: participants.length,
    marked: marked.length,
    present,
    absent,
    excused,
    trials,
    attendanceRate:
      marked.length > 0 ? Math.round((present / marked.length) * 100) : null,
    operationalState
  };
}

export async function getAdminSessionById(sessionId: string) {
  const prisma = getPrisma();

  return prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: participantInclude
  });
}

export async function getAdminSessionDetail(
  sessionId: string,
  now = new Date()
) {
  const session = await getAdminSessionById(sessionId);
  if (!session) return null;

  return {
    session,
    ...summarizeSession(session, now)
  };
}

export async function getAdminSessions(input: {
  branchId?: string | null;
  sportId?: string | null;
  groupId?: string | null;
  coachId?: string | null;
  scope?: string | null;
  now?: Date;
  todayStart?: Date;
  tomorrowStart?: Date;
  take?: number;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const scope = input.scope ?? "today";

  const startsAt =
    scope === "today" && input.todayStart && input.tomorrowStart
      ? {
          gte: input.todayStart,
          lt: input.tomorrowStart
        }
      : scope === "upcoming"
        ? { gt: now }
        : undefined;

  const status =
    scope === "completed"
      ? SessionStatus.COMPLETED
      : scope === "cancelled"
        ? SessionStatus.CANCELLED
        : undefined;

  const sessions = await prisma.trainingSession.findMany({
    where: {
      ...(input.branchId
        ? { group: { branchId: input.branchId } }
        : {}),
      ...(input.sportId
        ? {
            group: {
              ...(input.branchId ? { branchId: input.branchId } : {}),
              sportId: input.sportId
            }
          }
        : {}),
      ...(input.groupId ? { groupId: input.groupId } : {}),
      ...(input.coachId ? { coachId: input.coachId } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(status ? { status } : {}),
      ...(scope === "overdue"
        ? {
            status: SessionStatus.SCHEDULED,
            endsAt: { lt: now }
          }
        : {})
    },
    include: participantInclude,
    orderBy:
      scope === "upcoming" || scope === "today"
        ? { startsAt: "asc" }
        : { startsAt: "desc" },
    take: input.take ?? 300
  });

  return sessions.map((session) => ({
    session,
    ...summarizeSession(session, now)
  }));
}
