import {
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

export async function refreshProgressOverdueAlert(input: {
  childId: string;
  groupId: string;
  now?: Date;
  overdueDays?: number;
}) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const overdueDays = input.overdueDays ?? 35;
  const cutoff = new Date(now.getTime() - overdueDays * DAY);

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
      childId: input.childId,
      groupId: input.groupId
    },
    orderBy: { assessedAt: "desc" }
  });

  const overdue = !latest || latest.assessedAt < cutoff;
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
      latestAssessmentAt: latest?.assessedAt ?? null,
      resolved: resolved.count > 0
    };
  }

  const daysSinceAssessment = latest
    ? Math.floor((now.getTime() - latest.assessedAt.getTime()) / DAY)
    : null;

  const details = latest
    ? "Последняя оценка: " +
      latest.assessedAt.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" }) +
      " · прошло " +
      daysSinceAssessment +
      " дн."
    : "У ученика ещё нет регулярной оценки прогресса.";

  const alert = await prisma.operationalAlert.upsert({
    where: { dedupeKey },
    update: {
      type: OperationalAlertType.PROGRESS_OVERDUE,
      status: OperationalAlertStatus.OPEN,
      severity: daysSinceAssessment !== null && daysSinceAssessment >= 60 ? "critical" : "warning",
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — просрочена оценка прогресса",
      details,
      resolvedAt: null
    },
    create: {
      type: OperationalAlertType.PROGRESS_OVERDUE,
      status: OperationalAlertStatus.OPEN,
      severity: daysSinceAssessment !== null && daysSinceAssessment >= 60 ? "critical" : "warning",
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      groupId: enrollment.groupId,
      title: enrollment.child.name + " — просрочена оценка прогресса",
      details,
      dedupeKey,
      openedAt: now
    }
  });

  return {
    overdue: true as const,
    latestAssessmentAt: latest?.assessedAt ?? null,
    daysSinceAssessment,
    alert
  };
}

export async function refreshAllProgressOverdueAlerts(
  now = new Date(),
  overdueDays = 35
) {
  const prisma = getPrisma();
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { status: StudentEnrollmentStatus.ACTIVE },
    select: { childId: true, groupId: true }
  });

  let open = 0;
  let clear = 0;

  for (let index = 0; index < enrollments.length; index += 20) {
    const chunk = enrollments.slice(index, index + 20);
    const results = await Promise.all(
      chunk.map((item) =>
        refreshProgressOverdueAlert({
          childId: item.childId,
          groupId: item.groupId,
          now,
          overdueDays
        })
      )
    );

    open += results.filter((item) => item.overdue).length;
    clear += results.filter((item) => !item.overdue).length;
  }

  return { checked: enrollments.length, open, clear };
}
