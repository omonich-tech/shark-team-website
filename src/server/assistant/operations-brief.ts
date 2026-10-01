import {
  LeadStatus,
  LifecycleStatus,
  OperationalAlertStatus,
  PaymentStatus,
  StudentEnrollmentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type OperationsAssistantAction = {
  id: string;
  priority: "critical" | "high" | "normal";
  category:
    | "payment"
    | "attendance"
    | "progress"
    | "lead"
    | "trial"
    | "capacity";
  title: string;
  reason: string;
  href: string;
  subject: string | null;
  createdAt: Date;
};

function priorityRank(value: OperationsAssistantAction["priority"]) {
  return value === "critical" ? 0 : value === "high" ? 1 : 2;
}

export async function buildOperationsAssistantBrief(now = new Date()) {
  const prisma = getPrisma();
  const staleLeadCutoff = new Date(now.getTime() - 2 * HOUR);
  const upcomingTrialCutoff = new Date(now.getTime() + 24 * HOUR);
  const assessmentCutoff = new Date(now.getTime() - 35 * DAY);

  const [
    alerts,
    staleLeads,
    paymentsUnderReview,
    upcomingTrials,
    groups,
    activeStudents,
    progressDueCount
  ] = await Promise.all([
    prisma.operationalAlert.findMany({
      where: { status: OperationalAlertStatus.OPEN },
      include: {
        child: true,
        group: true
      },
      orderBy: { openedAt: "asc" },
      take: 100
    }),
    prisma.lead.findMany({
      where: {
        status: LeadStatus.NEW,
        createdAt: { lte: staleLeadCutoff }
      },
      orderBy: { createdAt: "asc" },
      take: 30
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: PaymentStatus.UNDER_REVIEW },
      include: {
        enrollment: {
          include: {
            child: true,
            group: true
          }
        }
      },
      orderBy: { submittedAt: "asc" },
      take: 30
    }),
    prisma.trialBooking.findMany({
      where: {
        status: TrialBookingStatus.CONFIRMED,
        session: {
          startsAt: {
            gte: now,
            lte: upcomingTrialCutoff
          }
        }
      },
      include: {
        lead: true,
        session: {
          include: {
            group: true
          }
        }
      },
      orderBy: {
        session: { startsAt: "asc" }
      },
      take: 30
    }),
    prisma.trainingGroup.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        branch: true,
        _count: {
          select: {
            enrollments: {
              where: { status: StudentEnrollmentStatus.ACTIVE }
            }
          }
        }
      }
    }),
    prisma.studentEnrollment.count({
      where: { status: StudentEnrollmentStatus.ACTIVE }
    }),
    prisma.studentEnrollment.count({
      where: {
        status: StudentEnrollmentStatus.ACTIVE,
        child: {
          progressAssessments: {
            none: {
              assessedAt: { gte: assessmentCutoff }
            }
          }
        }
      }
    })
  ]);

  const actions: OperationsAssistantAction[] = alerts.map((alert) => {
    const category =
      alert.type === "PAYMENT_ATTENTION"
        ? "payment"
        : alert.type === "ATTENDANCE_RISK"
          ? "attendance"
          : "progress";

    return {
      id: "alert:" + alert.id,
      priority:
        alert.severity === "critical" ? "critical" : "high",
      category,
      title: alert.title,
      reason: alert.details ?? "Системный сигнал требует проверки.",
      href: alert.childId
        ? "/admin/children/" + alert.childId
        : alert.groupId
          ? "/admin/groups/" + alert.groupId
          : "/admin/subscriptions",
      subject: alert.child?.name ?? alert.group?.internalName ?? null,
      createdAt: alert.openedAt
    };
  });

  for (const payment of paymentsUnderReview) {
    actions.push({
      id: "payment-review:" + payment.id,
      priority: "high",
      category: "payment",
      title: "Проверить поступившую оплату",
      reason:
        "Чек отправлен и находится в статусе UNDER_REVIEW. До проверки платёжный сценарий не должен двигаться дальше.",
      href: payment.enrollment?.childId
        ? "/admin/children/" + payment.enrollment.childId
        : "/admin/subscriptions",
      subject: payment.enrollment?.child.name ?? null,
      createdAt: payment.submittedAt ?? payment.updatedAt
    });
  }

  for (const lead of staleLeads) {
    actions.push({
      id: "lead:" + lead.id,
      priority: "high",
      category: "lead",
      title: "Новый лид без продвижения",
      reason:
        "Заявка остаётся в статусе NEW больше двух часов. Нужно связаться и довести до выбора пробного занятия.",
      href: "/admin/leads",
      subject: lead.childName + " · " + lead.parentName,
      createdAt: lead.createdAt
    });
  }

  for (const booking of upcomingTrials) {
    actions.push({
      id: "trial:" + booking.id,
      priority: "normal",
      category: "trial",
      title: "Пробное занятие в ближайшие 24 часа",
      reason:
        "Проверить готовность записи, связь с родителем и наличие места в группе.",
      href: "/admin/trials",
      subject:
        booking.lead.childName + " · " + booking.session.group.internalName,
      createdAt: booking.session.startsAt
    });
  }

  for (const group of groups) {
    const occupied = group._count.enrollments;
    const free = Math.max(0, group.capacityRegular - occupied);
    const fillRate =
      group.capacityRegular > 0
        ? Math.round((occupied / group.capacityRegular) * 100)
        : 0;

    if (fillRate >= 90) {
      actions.push({
        id: "capacity:" + group.id,
        priority: free === 0 ? "high" : "normal",
        category: "capacity",
        title: free === 0 ? "Группа заполнена" : "Группа почти заполнена",
        reason:
          occupied +
          "/" +
          group.capacityRegular +
          " мест занято · свободно " +
          free +
          ". Учитывать это при записи новых пробных.",
        href: "/admin/groups/" + group.id,
        subject: group.internalName + " · " + group.branch.publicNameRu,
        createdAt: group.updatedAt
      });
    }
  }

  actions.sort((a, b) => {
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const critical = actions.filter((item) => item.priority === "critical").length;
  const high = actions.filter((item) => item.priority === "high").length;
  const normal = actions.filter((item) => item.priority === "normal").length;

  const headline =
    critical > 0
      ? "Есть критические задачи, которые требуют действия администратора."
      : high > 0
        ? "Критических проблем нет, но есть задачи с высоким приоритетом."
        : actions.length > 0
          ? "Основные процессы стабильны. Остались плановые действия."
          : "Операционных задач на текущий момент нет.";

  return {
    generatedAt: now,
    headline,
    counts: {
      critical,
      high,
      normal,
      total: actions.length,
      activeStudents,
      progressDue: progressDueCount,
      newLeadsWaiting: staleLeads.length,
      paymentsUnderReview: paymentsUnderReview.length,
      trialsNext24h: upcomingTrials.length
    },
    actions: actions.slice(0, 50)
  };
}
