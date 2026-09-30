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

  return prisma.notification.upsert({
    where: {
      dedupeKey: "attendance:" + input.attendanceId + ":absence"
    },
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
      dedupeKey: "attendance:" + input.attendanceId + ":absence"
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
