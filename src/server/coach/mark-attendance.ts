import {
  AttendanceStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getCoachSessionParticipants } from "@/server/coach/get-session-participants";

export async function markCoachAttendance(input: {
  coachId: string;
  sessionId: string;
  childId: string;
  status: AttendanceStatus;
}) {
  const data = await getCoachSessionParticipants(
    input.coachId,
    input.sessionId
  );

  if (!data) {
    return { ok: false as const, error: "SESSION_NOT_FOUND" as const };
  }

  const participant = data.participants.find(
    (item) => item.childId === input.childId
  );

  if (!participant) {
    return { ok: false as const, error: "CHILD_NOT_IN_SESSION" as const };
  }

  const prisma = getPrisma();
  const now = new Date();

  const attendance = await prisma.attendance.upsert({
    where: {
      sessionId_childId: {
        sessionId: input.sessionId,
        childId: input.childId
      }
    },
    update: {
      coachId: input.coachId,
      trialBookingId: participant.trialBookingId,
      status: input.status,
      markedAt: now
    },
    create: {
      sessionId: input.sessionId,
      childId: input.childId,
      coachId: input.coachId,
      trialBookingId: participant.trialBookingId,
      status: input.status,
      markedAt: now
    }
  });

  if (participant.trialBookingId) {
    if (input.status === AttendanceStatus.PRESENT) {
      await prisma.trialBooking.update({
        where: { id: participant.trialBookingId },
        data: {
          status: TrialBookingStatus.ATTENDED
        }
      });
    }

    if (input.status === AttendanceStatus.ABSENT) {
      await prisma.trialBooking.update({
        where: { id: participant.trialBookingId },
        data: {
          status: TrialBookingStatus.NO_SHOW
        }
      });
    }
  }

  return {
    ok: true as const,
    attendance: {
      id: attendance.id,
      status: attendance.status,
      markedAt: attendance.markedAt.toISOString()
    }
  };
}
