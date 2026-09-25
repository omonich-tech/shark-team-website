import { TrialBookingStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export type TrialAssessmentInput = {
  coachId: string;
  trialBookingId: string;
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
  coachComment?: string | null;
  recommendation?: string | null;
};

function validScore(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function cleanOptional(value: string | null | undefined, max = 1000) {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, max);
  return cleaned || null;
}

export async function saveTrialAssessment(input: TrialAssessmentInput) {
  const scores = [
    input.ability,
    input.discipline,
    input.motivation,
    input.coordination,
    input.physicalPreparation,
    input.psychologicalReadiness
  ];

  if (!scores.every(validScore)) {
    return { ok: false as const, error: "INVALID_SCORE" as const };
  }

  const prisma = getPrisma();

  const booking = await prisma.trialBooking.findFirst({
    where: {
      id: input.trialBookingId,
      session: {
        coachId: input.coachId
      }
    }
  });

  if (!booking) {
    return { ok: false as const, error: "TRIAL_NOT_FOUND" as const };
  }

  if (booking.status !== TrialBookingStatus.ATTENDED) {
    return { ok: false as const, error: "TRIAL_NOT_ATTENDED" as const };
  }

  const assessment = await prisma.trialAssessment.upsert({
    where: {
      trialBookingId: booking.id
    },
    update: {
      coachId: input.coachId,
      ability: input.ability,
      discipline: input.discipline,
      motivation: input.motivation,
      coordination: input.coordination,
      physicalPreparation: input.physicalPreparation,
      psychologicalReadiness: input.psychologicalReadiness,
      coachComment: cleanOptional(input.coachComment),
      recommendation: cleanOptional(input.recommendation, 500)
    },
    create: {
      trialBookingId: booking.id,
      coachId: input.coachId,
      ability: input.ability,
      discipline: input.discipline,
      motivation: input.motivation,
      coordination: input.coordination,
      physicalPreparation: input.physicalPreparation,
      psychologicalReadiness: input.psychologicalReadiness,
      coachComment: cleanOptional(input.coachComment),
      recommendation: cleanOptional(input.recommendation, 500)
    }
  });

  return {
    ok: true as const,
    assessment: {
      id: assessment.id,
      updatedAt: assessment.updatedAt.toISOString()
    }
  };
}
