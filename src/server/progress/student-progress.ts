import {
  NotificationType,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { refreshProgressAlert } from "@/server/progress/progress-alerts";

type Scores = {
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
};

function validScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function createStudentProgressAssessment(input: {
  coachId: string;
  childId: string;
  scores: Scores;
  coachComment?: string | null;
  recommendation?: string | null;
  now?: Date;
}) {
  if (!Object.values(input.scores).every(validScore)) {
    return { ok: false as const, error: "INVALID_SCORE" as const };
  }

  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: input.childId,
      status: StudentEnrollmentStatus.ACTIVE,
      group: { primaryCoachId: input.coachId },
      OR: [
        { subscriptionStatus: null },
        {
          subscriptionStatus: {
            notIn: [
              SubscriptionStatus.FROZEN,
              SubscriptionStatus.PAUSED,
              SubscriptionStatus.ENDED
            ]
          }
        }
      ]
    },
    include: {
      child: true,
      group: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (!enrollment) {
    return { ok: false as const, error: "STUDENT_NOT_AVAILABLE" as const };
  }

  const assessment = await prisma.studentProgressAssessment.create({
    data: {
      childId: enrollment.childId,
      groupId: enrollment.groupId,
      coachId: input.coachId,
      ...input.scores,
      coachComment:
        input.coachComment?.trim().slice(0, 1500) || null,
      recommendation:
        input.recommendation?.trim().slice(0, 1500) || null,
      assessedAt: now
    }
  });

  await prisma.notification.create({
    data: {
      type: NotificationType.STUDENT_PROGRESS_UPDATE,
      parentId: enrollment.child.parentId,
      progressAssessmentId: assessment.id,
      scheduledAt: now,
      dedupeKey: "progress:" + assessment.id + ":parent"
    }
  });

  await refreshProgressAlert({
    childId: enrollment.childId,
    groupId: enrollment.groupId,
    now
  });

  return {
    ok: true as const,
    assessment,
    enrollment
  };
}
