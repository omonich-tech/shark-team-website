import {
  AbsenceReason,
  AttendanceReasonSource,
  AttendanceStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  queueRegularAbsenceNotice,
  skipRegularAbsenceNotice
} from "@/server/attendance/absence-reason";
import { getCoachSessionParticipants } from "@/server/coach/get-session-participants";
import { refreshAttendanceRiskAlert } from "@/server/attendance/risk-alerts";

export async function markCoachAttendance(input: {
  coachId: string;
  sessionId: string;
  childId: string;
  status: AttendanceStatus;
  absenceReason?: AbsenceReason | null;
  absenceNote?: string | null;
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

  const isAbsent =
    input.status === AttendanceStatus.ABSENT ||
    input.status === AttendanceStatus.EXCUSED;
  const reason = isAbsent ? input.absenceReason ?? null : null;
  const note = isAbsent
    ? input.absenceNote?.trim().slice(0, 500) || null
    : null;

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
      absenceReason: reason,
      absenceNote: note,
      reasonSource: reason ? AttendanceReasonSource.COACH : null,
      reasonUpdatedAt: reason ? now : null,
      markedAt: now
    },
    create: {
      sessionId: input.sessionId,
      childId: input.childId,
      coachId: input.coachId,
      trialBookingId: participant.trialBookingId,
      status: input.status,
      absenceReason: reason,
      absenceNote: note,
      reasonSource: reason ? AttendanceReasonSource.COACH : null,
      reasonUpdatedAt: reason ? now : null,
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


  if (!participant.trialBookingId) {
    if (input.status === AttendanceStatus.PRESENT) {
      await skipRegularAbsenceNotice(attendance.id);
    } else {
      const child = await prisma.child.findUnique({
        where: { id: input.childId },
        select: { parentId: true }
      });

      if (child?.parentId) {
        await queueRegularAbsenceNotice({
          attendanceId: attendance.id,
          parentId: child.parentId,
          scheduledAt: now
        });
      }
    }

    await refreshAttendanceRiskAlert({
      childId: input.childId,
      groupId: data.session.groupId,
      now
    });
  }

  return {
    ok: true as const,
    attendance: {
      id: attendance.id,
      status: attendance.status,
      absenceReason: attendance.absenceReason,
      absenceNote: attendance.absenceNote,
      markedAt: attendance.markedAt.toISOString()
    }
  };
}
