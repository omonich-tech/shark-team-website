import {
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;
const DUE_DAYS = 30;
const CRITICAL_DAYS = 45;

export async function refreshProgressAlert(input: {
  childId: string;
  groupId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId: input.childId,
      groupId: input.groupId,
      status: StudentEnrollmentStatus.ACTIVE,
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
    await prisma.operationalAlert.updateMany({
      where: {
        type: OperationalAlertType.PROGRESS_OVERDUE,
        status: OperationalAlertStatus.OPEN,
        childId: input.childId,
        groupId: input.groupId
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now
      }
    });
    return { overdue: false as const, reason: "NO_ACTIVE_ENROLLMENT" as const };
  }

  const latest = await prisma.studentProgressAssessment.findFirst({
    where: {
      childId: enrollment.childId,
      groupId: enrollment.groupId
    },
    orderBy: { assessedAt: "desc" }
  });

  const reference = latest?.assessedAt ?? enrollment.startDate;
  const ageDays = Math.floor((now.getTime() - reference.getTime()) / DAY);
  const overdue = ageDays >= DUE_DAYS;
  const dedupeKey = "progress-overdue:" + enrollment.id;

  if (!overdue) {
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
      overdue: false as const,
      ageDays,
      latestAssessmentAt: latest?.assessedAt ?? null,
      resolved: resolved.count > 0
    };
  }

  const overdueDays = ageDays - DUE_DAYS;
  const details = latest
    ? "Последняя оценка " +
      ageDays +
      " дн. назад · просрочка " +
      overdueDays +
      " дн."
    : "После зачисления прошло " +
      ageDays +
      " дн. · регулярной оценки ещё нет";

  const alert = await prisma.operationalAlert.upsert({
    where: { dedupeKey },
    update: {
      type: OperationalAlertType.PROGRESS_OVERDUE,
      status: OperationalAlertStatus.OPEN,
      severity: ageDays >= CRITICAL_DAYS ? "critical" : "warning",
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — пора обновить прогресс",
      details,
      resolvedAt: null
    },
    create: {
      type: OperationalAlertType.PROGRESS_OVERDUE,
      status: OperationalAlertStatus.OPEN,
      severity: ageDays >= CRITICAL_DAYS ? "critical" : "warning",
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — пора обновить прогресс",
      details,
      dedupeKey,
      openedAt: now
    }
  });

  return {
    overdue: true as const,
    ageDays,
    latestAssessmentAt: latest?.assessedAt ?? null,
    alert
  };
}

export async function refreshAllProgressAlerts(now = new Date()) {
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

  let overdue = 0;
  let clear = 0;

  for (let index = 0; index < enrollments.length; index += 20) {
    const chunk = enrollments.slice(index, index + 20);
    const results = await Promise.all(
      chunk.map((item) =>
        refreshProgressAlert({
          childId: item.childId,
          groupId: item.groupId,
          now
        })
      )
    );
    overdue += results.filter((item) => item.overdue).length;
    clear += results.filter((item) => !item.overdue).length;
  }

  return {
    checked: enrollments.length,
    overdue,
    clear
  };
}
