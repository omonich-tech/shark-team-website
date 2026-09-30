import {
  AttendanceStatus,
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

function rate(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

export async function refreshAttendanceRiskAlert(input: {
  childId: string;
  groupId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: input.childId,
      groupId: input.groupId,
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: true,
      group: true
    },
    orderBy: { createdAt: "desc" }
  });

  if (!enrollment) {
    await prisma.operationalAlert.updateMany({
      where: {
        type: OperationalAlertType.ATTENDANCE_RISK,
        status: OperationalAlertStatus.OPEN,
        childId: input.childId,
        groupId: input.groupId
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now
      }
    });

    return {
      risk: false as const,
      reason: "NO_ACTIVE_ENROLLMENT" as const
    };
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      childId: input.childId,
      trialBookingId: null,
      session: {
        groupId: input.groupId,
        startsAt: {
          gte: since30,
          lte: now
        }
      }
    },
    include: {
      session: true
    },
    orderBy: {
      session: {
        startsAt: "desc"
      }
    },
    take: 30
  });

  const present = attendance.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const attendanceRate = rate(present, attendance.length);

  let consecutiveMisses = 0;
  for (const item of attendance) {
    if (item.status === AttendanceStatus.PRESENT) break;
    consecutiveMisses += 1;
  }

  const lowAttendance =
    attendance.length >= 4 && (attendanceRate ?? 100) < 70;
  const risk = consecutiveMisses >= 2 || lowAttendance;
  const dedupeKey = "attendance-risk:" + enrollment.id;

  if (!risk) {
    const resolved = await prisma.operationalAlert.updateMany({
      where: {
        dedupeKey,
        status: OperationalAlertStatus.OPEN
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now
      }
    });

    return {
      risk: false as const,
      consecutiveMisses,
      attendanceRate,
      total: attendance.length,
      resolved: resolved.count > 0
    };
  }

  const severity =
    consecutiveMisses >= 3 || (attendanceRate !== null && attendanceRate < 50)
      ? "critical"
      : "warning";
  const details = [
    consecutiveMisses >= 2
      ? "Пропусков подряд: " + consecutiveMisses
      : null,
    attendanceRate !== null
      ? "Посещаемость за 30 дней: " + attendanceRate + "%"
      : null,
    "Отмечено занятий: " + attendance.length
  ]
    .filter(Boolean)
    .join(" · ");

  const alert = await prisma.operationalAlert.upsert({
    where: { dedupeKey },
    update: {
      type: OperationalAlertType.ATTENDANCE_RISK,
      status: OperationalAlertStatus.OPEN,
      severity,
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — риск по посещаемости",
      details,
      resolvedAt: null
    },
    create: {
      type: OperationalAlertType.ATTENDANCE_RISK,
      status: OperationalAlertStatus.OPEN,
      severity,
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — риск по посещаемости",
      details,
      dedupeKey,
      openedAt: now
    }
  });

  return {
    risk: true as const,
    consecutiveMisses,
    attendanceRate,
    total: attendance.length,
    alert
  };
}

export async function refreshAllAttendanceRiskAlerts(now = new Date()) {
  const prisma = getPrisma();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE
    },
    select: {
      childId: true,
      groupId: true
    }
  });

  let open = 0;
  let clear = 0;

  for (let index = 0; index < enrollments.length; index += 20) {
    const chunk = enrollments.slice(index, index + 20);
    const results = await Promise.all(
      chunk.map((item) =>
        refreshAttendanceRiskAlert({
          childId: item.childId,
          groupId: item.groupId,
          now
        })
      )
    );

    open += results.filter((item) => item.risk).length;
    clear += results.filter((item) => !item.risk).length;
  }

  return {
    checked: enrollments.length,
    open,
    clear
  };
}
