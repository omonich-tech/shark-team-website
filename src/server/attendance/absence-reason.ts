import {
  AbsenceReason,
  AttendanceReasonSource,
  AttendanceStatus,
  NotificationStatus,
  NotificationType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const ABSENCE_REASON_VALUES = [
  AbsenceReason.ILLNESS,
  AbsenceReason.FAMILY,
  AbsenceReason.TRAVEL,
  AbsenceReason.SCHOOL,
  AbsenceReason.OTHER
] as const;

export function absenceReasonLabel(
  reason: AbsenceReason,
  locale: "ru" | "uz"
) {
  const labels = {
    ru: {
      ILLNESS: "Болезнь",
      FAMILY: "Семейные обстоятельства",
      TRAVEL: "Поездка",
      SCHOOL: "Учёба / школа",
      OTHER: "Другая причина"
    },
    uz: {
      ILLNESS: "Kasallik",
      FAMILY: "Oilaviy sabab",
      TRAVEL: "Safar",
      SCHOOL: "O‘qish / maktab",
      OTHER: "Boshqa sabab"
    }
  } as const;

  return labels[locale][reason];
}

export async function queueRegularAbsenceNotice(input: {
  attendanceId: string;
  parentId: string;
  scheduledAt?: Date;
}) {
  const prisma = getPrisma();
  const scheduledAt = input.scheduledAt ?? new Date();

  const dedupeKey = "attendance:" + input.attendanceId + ":absence";
  const existing = await prisma.notification.findUnique({
    where: { dedupeKey }
  });

  if (existing?.status === NotificationStatus.SENT) {
    return existing;
  }

  return prisma.notification.upsert({
    where: { dedupeKey },
    update: {
      type: NotificationType.REGULAR_ABSENCE_NOTICE,
      parentId: input.parentId,
      attendanceId: input.attendanceId,
      scheduledAt,
      status: NotificationStatus.PENDING,
      attempts: 0,
      sentAt: null,
      lastError: null
    },
    create: {
      type: NotificationType.REGULAR_ABSENCE_NOTICE,
      parentId: input.parentId,
      attendanceId: input.attendanceId,
      scheduledAt,
      dedupeKey
    }
  });
}

export async function skipRegularAbsenceNotice(attendanceId: string) {
  const prisma = getPrisma();

  return prisma.notification.updateMany({
    where: {
      attendanceId,
      type: NotificationType.REGULAR_ABSENCE_NOTICE,
      status: NotificationStatus.PENDING
    },
    data: {
      status: NotificationStatus.SKIPPED,
      lastError: "ATTENDANCE_CHANGED"
    }
  });
}

export async function setParentAttendanceReason(input: {
  telegramUserId: bigint;
  attendanceId: string;
  reason: AbsenceReason;
}) {
  const prisma = getPrisma();
  const contact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: input.telegramUserId
    }
  });

  if (!contact?.parentId) {
    return { ok: false as const, error: "PARENT_NOT_LINKED" as const };
  }

  const attendance = await prisma.attendance.findUnique({
    where: { id: input.attendanceId },
    include: {
      child: {
        include: {
          parent: true
        }
      },
      session: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true
            }
          }
        }
      }
    }
  });

  if (!attendance || attendance.child.parentId !== contact.parentId) {
    return { ok: false as const, error: "ATTENDANCE_NOT_FOUND" as const };
  }

  if (
    attendance.trialBookingId ||
    attendance.status === AttendanceStatus.PRESENT
  ) {
    return { ok: false as const, error: "ATTENDANCE_NOT_EDITABLE" as const };
  }

  const updated = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      absenceReason: input.reason,
      reasonSource: AttendanceReasonSource.PARENT,
      reasonUpdatedAt: new Date()
    }
  });

  return {
    ok: true as const,
    attendance: updated,
    locale: contact.locale === "uz" ? ("uz" as const) : ("ru" as const),
    childName: attendance.child.name
  };
}


export async function setParentPlannedAbsence(input: {
  telegramUserId: bigint;
  childId: string;
  sessionId: string;
  reason: AbsenceReason;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const contact = await prisma.telegramContact.findUnique({
    where: {
      telegramUserId: input.telegramUserId
    }
  });

  if (!contact?.parentId) {
    return { ok: false as const, error: "PARENT_NOT_LINKED" as const };
  }

  const child = await prisma.child.findFirst({
    where: {
      id: input.childId,
      parentId: contact.parentId
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!child) {
    return { ok: false as const, error: "CHILD_NOT_FOUND" as const };
  }

  const session = await prisma.trainingSession.findFirst({
    where: {
      id: input.sessionId,
      status: "SCHEDULED",
      startsAt: { gt: now },
      group: {
        enrollments: {
          some: {
            childId: child.id,
            status: "ACTIVE",
            startDate: { lte: now },
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          }
        }
      }
    },
    include: {
      group: {
        include: {
          sport: true,
          branch: true
        }
      }
    }
  });

  if (!session) {
    return {
      ok: false as const,
      error: "SESSION_NOT_AVAILABLE" as const
    };
  }

  const existing = await prisma.attendance.findUnique({
    where: {
      sessionId_childId: {
        sessionId: session.id,
        childId: child.id
      }
    }
  });

  if (
    existing?.trialBookingId ||
    existing?.status === AttendanceStatus.PRESENT
  ) {
    return {
      ok: false as const,
      error: "ATTENDANCE_NOT_EDITABLE" as const
    };
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      sessionId_childId: {
        sessionId: session.id,
        childId: child.id
      }
    },
    update: {
      coachId: session.coachId,
      status: AttendanceStatus.EXCUSED,
      absenceReason: input.reason,
      absenceNote: null,
      reasonSource: AttendanceReasonSource.PARENT,
      reasonUpdatedAt: now,
      markedAt: now
    },
    create: {
      sessionId: session.id,
      childId: child.id,
      coachId: session.coachId,
      status: AttendanceStatus.EXCUSED,
      absenceReason: input.reason,
      reasonSource: AttendanceReasonSource.PARENT,
      reasonUpdatedAt: now,
      markedAt: now
    }
  });

  await skipRegularAbsenceNotice(attendance.id);

  return {
    ok: true as const,
    locale: contact.locale === "uz" ? ("uz" as const) : ("ru" as const),
    childName: child.name,
    session: {
      id: session.id,
      startsAt: session.startsAt,
      groupName: session.group.internalName,
      sportNameRu: session.group.sport.nameRu,
      sportNameUz: session.group.sport.nameUz,
      branchNameRu: session.group.branch.publicNameRu,
      branchNameUz: session.group.branch.publicNameUz
    },
    attendance
  };
}
