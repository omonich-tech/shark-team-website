import {
  EnrollmentStatus,
  LifecycleStatus,
  SessionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export async function getTrialOptions(age: number) {
  if (!Number.isInteger(age) || age < 6 || age > 17) {
    return {
      ok: false as const,
      error: "AGE_NOT_SUPPORTED" as const
    };
  }

  const prisma = getPrisma();

  const group = await prisma.trainingGroup.findFirst({
    where: {
      status: LifecycleStatus.ACTIVE,
      enrollmentStatus: EnrollmentStatus.OPEN,
      ageMin: { lte: age },
      ageMax: { gte: age },
      branch: {
        slug: "school-117",
        status: LifecycleStatus.ACTIVE
      },
      sport: {
        slug: "basketball",
        status: LifecycleStatus.ACTIVE
      }
    },
    include: {
      branch: true,
      sport: true,
      primaryCoach: true
    },
    orderBy: [{ ageMin: "asc" }]
  });

  if (!group) {
    return {
      ok: false as const,
      error: "NO_MATCHING_GROUP" as const
    };
  }

  if (group.capacityTrial === null || group.capacityTrial <= 0) {
    return {
      ok: true as const,
      bookingAvailable: false as const,
      reason: "TRIAL_CAPACITY_NOT_CONFIGURED" as const,
      group: {
        id: group.id,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        branchNameRu: group.branch.publicNameRu,
        branchNameUz: group.branch.publicNameUz,
        sportNameRu: group.sport.nameRu,
        sportNameUz: group.sport.nameUz,
        coachName: [group.primaryCoach.firstName, group.primaryCoach.lastName]
          .filter(Boolean)
          .join(" ")
      },
      sessions: []
    };
  }

  const sessions = await prisma.trainingSession.findMany({
    where: {
      groupId: group.id,
      status: SessionStatus.SCHEDULED,
      startsAt: { gt: new Date() },
      trialBookingEnabled: true,
      trialCapacity: { gt: 0 }
    },
    orderBy: { startsAt: "asc" },
    take: 12
  });

  return {
    ok: true as const,
    bookingAvailable: sessions.length > 0,
    reason:
      sessions.length > 0
        ? null
        : ("NO_AVAILABLE_SESSIONS" as const),
    group: {
      id: group.id,
      ageMin: group.ageMin,
      ageMax: group.ageMax,
      branchNameRu: group.branch.publicNameRu,
      branchNameUz: group.branch.publicNameUz,
      sportNameRu: group.sport.nameRu,
      sportNameUz: group.sport.nameUz,
      coachName: [group.primaryCoach.firstName, group.primaryCoach.lastName]
        .filter(Boolean)
        .join(" ")
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString()
    }))
  };
}
