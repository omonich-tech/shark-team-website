import {
  AttendanceReasonSource,
  AttendanceStatus,
  NotificationStatus,
  NotificationType,
  SessionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeAdminAudit, writeCoachAudit } from "@/server/admin/audit";
import { queueRegularAbsenceNotice } from "@/server/attendance/absence-reason";
import { refreshAttendanceRiskAlert } from "@/server/attendance/risk-alerts";
import { getCoachSessionParticipants } from "@/server/coach/get-session-participants";

export async function completeCoachTrainingSession(input: {
  coachId: string;
  sessionId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const data = await getCoachSessionParticipants(
    input.coachId,
    input.sessionId
  );

  if (!data) {
    return {
      ok: false as const,
      error: "SESSION_NOT_FOUND" as const
    };
  }

  if (data.session.status !== SessionStatus.SCHEDULED) {
    return {
      ok: false as const,
      error: "SESSION_NOT_COMPLETABLE" as const
    };
  }

  if (data.session.startsAt > now) {
    return {
      ok: false as const,
      error: "SESSION_NOT_STARTED" as const
    };
  }

  const unmarked = data.participants.filter(
    (participant) => !participant.attendanceStatus
  );

  if (unmarked.length > 0) {
    return {
      ok: false as const,
      error: "ATTENDANCE_INCOMPLETE" as const,
      unmarked: unmarked.map((participant) => ({
        childId: participant.childId,
        childName: participant.childName
      }))
    };
  }

  const before = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: input.sessionId }
  });

  const updated = await prisma.trainingSession.update({
    where: { id: input.sessionId },
    data: {
      status: SessionStatus.COMPLETED,
      completedAt: now
    }
  });

  const attendances = await prisma.attendance.findMany({
    where: { sessionId: input.sessionId },
    include: {
      child: {
        select: {
          parentId: true
        }
      }
    }
  });

  let absenceFollowUps = 0;

  for (const attendance of attendances) {
    if (attendance.trialBookingId) {
      continue;
    }

    if (attendance.status === AttendanceStatus.PRESENT) {
      await refreshAttendanceRiskAlert({
        childId: attendance.childId,
        groupId: data.session.groupId,
        now
      });
      continue;
    }

    if (
      attendance.reasonSource !== AttendanceReasonSource.PARENT
    ) {
      await queueRegularAbsenceNotice({
        attendanceId: attendance.id,
        parentId: attendance.child.parentId,
        scheduledAt: now
      });
      absenceFollowUps += 1;
    }

    await refreshAttendanceRiskAlert({
      childId: attendance.childId,
      groupId: data.session.groupId,
      now
    });
  }

  await writeCoachAudit({
    actorId: input.coachId,
    action: "COMPLETE_TRAINING_SESSION",
    entityType: "TrainingSession",
    entityId: input.sessionId,
    before,
    after: updated
  });

  return {
    ok: true as const,
    session: updated,
    summary: {
      participants: data.participants.length,
      present: data.participants.filter(
        (participant) =>
          participant.attendanceStatus === AttendanceStatus.PRESENT
      ).length,
      absent: data.participants.filter(
        (participant) =>
          participant.attendanceStatus === AttendanceStatus.ABSENT
      ).length,
      excused: data.participants.filter(
        (participant) =>
          participant.attendanceStatus === AttendanceStatus.EXCUSED
      ).length,
      absenceFollowUps
    }
  };
}

export async function reopenTrainingSession(input: {
  adminId: string;
  sessionId: string;
  reason: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const reason = input.reason.trim().slice(0, 500);

  if (!reason) {
    return {
      ok: false as const,
      error: "REOPEN_REASON_REQUIRED" as const
    };
  }

  const before = await prisma.trainingSession.findUnique({
    where: { id: input.sessionId }
  });

  if (!before) {
    return {
      ok: false as const,
      error: "SESSION_NOT_FOUND" as const
    };
  }

  if (before.status !== SessionStatus.COMPLETED) {
    return {
      ok: false as const,
      error: "SESSION_NOT_REOPENABLE" as const
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.update({
      where: { id: input.sessionId },
      data: {
        status: SessionStatus.SCHEDULED,
        completedAt: null
      }
    });

    await tx.notification.updateMany({
      where: {
        type: NotificationType.REGULAR_ABSENCE_NOTICE,
        status: NotificationStatus.PENDING,
        attendance: {
          sessionId: input.sessionId
        }
      },
      data: {
        status: NotificationStatus.SKIPPED,
        lastError: "SESSION_REOPENED"
      }
    });

    return session;
  });

  await writeAdminAudit({
    actorId: input.adminId,
    action: "REOPEN_TRAINING_SESSION",
    entityType: "TrainingSession",
    entityId: input.sessionId,
    before,
    after: {
      ...updated,
      reopenReason: reason,
      reopenedAt: now
    }
  });

  return {
    ok: true as const,
    session: updated
  };
}
