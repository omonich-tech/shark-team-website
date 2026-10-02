import Link from "next/link";
import {
  AttendanceStatus,
  LifecycleStatus,
  OperationalAlertStatus,
  PaymentStatus,
  StudentEnrollmentStatus,
  TrialBookingStatus,
  TrialConversionStatus
} from "@/generated/prisma/client";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";
import {
  dateKeyInTimeZone,
  localDateTimeToUtc
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Asia/Tashkent";
const DAY = 24 * 60 * 60 * 1000;

function monthRange(now: Date) {
  const dateKey = dateKeyInTimeZone(now, TIME_ZONE);
  const [year, month] = dateKey.split("-").map(Number);
  const startKey =
    String(year).padStart(4, "0") +
    "-" +
    String(month).padStart(2, "0") +
    "-01";
  const next = new Date(Date.UTC(year, month, 1));
  const nextKey =
    String(next.getUTCFullYear()).padStart(4, "0") +
    "-" +
    String(next.getUTCMonth() + 1).padStart(2, "0") +
    "-01";

  return {
    start: localDateTimeToUtc(startKey, 0, 0, TIME_ZONE),
    end: localDateTimeToUtc(nextKey, 0, 0, TIME_ZONE),
    label: new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: TIME_ZONE
    }).format(now)
  };
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function alertLink(alert: {
  childId: string | null;
  groupId: string | null;
  enrollmentId: string | null;
}) {
  if (alert.childId) return "/admin/children/" + alert.childId;
  if (alert.groupId) return "/admin/groups/" + alert.groupId;
  if (alert.enrollmentId) return "/admin/subscriptions";
  return "/admin";
}

export default async function AdminDashboardPage() {
  const prisma = getPrisma();
  const now = new Date();
  const month = monthRange(now);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [
    leadsMonth,
    leadsTotal,
    trialHolds,
    confirmedTrials,
    attendedTrialsMonth,
    enrolledFromTrialMonth,
    activeStudents,
    paidTrialsMonth,
    paidSubscriptionsMonth,
    unpaidDue,
    attendanceTotal30,
    attendancePresent30,
    groups,
    openAlerts,
    alertGroups,
    recentLeads,
    sessionsToday,
    overdueSessions
  ] = await Promise.all([
    prisma.lead.count({
      where: {
        createdAt: { gte: month.start, lt: month.end }
      }
    }),
    prisma.lead.count(),
    prisma.trialBooking.count({
      where: {
        status: {
          in: [
            TrialBookingStatus.HOLD,
            TrialBookingStatus.PAYMENT_PENDING
          ]
        }
      }
    }),
    prisma.trialBooking.count({
      where: {
        status: TrialBookingStatus.CONFIRMED,
        session: { startsAt: { gt: now } }
      }
    }),
    prisma.trialBooking.count({
      where: {
        status: TrialBookingStatus.ATTENDED,
        session: {
          startsAt: { gte: month.start, lt: month.end }
        }
      }
    }),
    prisma.trialConversion.count({
      where: {
        status: TrialConversionStatus.ENROLLED,
        enrolledAt: { gte: month.start, lt: month.end }
      }
    }),
    prisma.studentEnrollment.count({
      where: { status: StudentEnrollmentStatus.ACTIVE }
    }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: month.start, lt: month.end }
      },
      _sum: { amountUzs: true },
      _count: true
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: month.start, lt: month.end }
      },
      _sum: { amountUzs: true },
      _count: true
    }),
    prisma.subscriptionPayment.aggregate({
      where: {
        status: PaymentStatus.PENDING,
        dueAt: { not: null, lte: now }
      },
      _sum: { amountUzs: true },
      _count: true
    }),
    prisma.attendance.count({
      where: {
        trialBookingId: null,
        session: {
          startsAt: { gte: since30, lte: now }
        }
      }
    }),
    prisma.attendance.count({
      where: {
        trialBookingId: null,
        status: AttendanceStatus.PRESENT,
        session: {
          startsAt: { gte: since30, lte: now }
        }
      }
    }),
    prisma.trainingGroup.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        branch: true,
        sport: true,
        _count: {
          select: {
            enrollments: {
              where: { status: StudentEnrollmentStatus.ACTIVE }
            }
          }
        }
      },
      orderBy: { internalName: "asc" }
    }),
    prisma.operationalAlert.findMany({
      where: { status: OperationalAlertStatus.OPEN },
      include: {
        child: true,
        group: true
      },
      orderBy: [{ severity: "asc" }, { openedAt: "asc" }],
      take: 15
    }),
    prisma.operationalAlert.groupBy({
      by: ["type"],
      where: { status: OperationalAlertStatus.OPEN },
      _count: { _all: true }
    }),
    prisma.lead.findMany({
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.trainingSession.count({
      where: {
        startsAt: {
          gte: localDateTimeToUtc(
            dateKeyInTimeZone(now, TIME_ZONE),
            0,
            0,
            TIME_ZONE
          ),
          lt: new Date(
            localDateTimeToUtc(
              dateKeyInTimeZone(now, TIME_ZONE),
              0,
              0,
              TIME_ZONE
            ).getTime() + DAY
          )
        }
      }
    }),
    prisma.trainingSession.count({
      where: {
        status: "SCHEDULED",
        endsAt: { lt: now }
      }
    })
  ]);

  const conversionRate = percent(enrolledFromTrialMonth, attendedTrialsMonth);
  const revenueMonth =
    (paidTrialsMonth._sum.amountUzs ?? 0) +
    (paidSubscriptionsMonth._sum.amountUzs ?? 0);
  const attendanceRate30 = percent(attendancePresent30, attendanceTotal30);

  const totalCapacity = groups.reduce(
    (sum, group) => sum + group.capacityRegular,
    0
  );
  const occupied = groups.reduce(
    (sum, group) => sum + group._count.enrollments,
    0
  );
  const fillRate = percent(occupied, totalCapacity);
  const fullGroups = groups.filter(
    (group) => group._count.enrollments >= group.capacityRegular
  ).length;

  const alertsByType = new Map(
    alertGroups.map((item) => [item.type, item._count._all])
  );
  const totalOpenAlerts = alertGroups.reduce(
    (sum, item) => sum + item._count._all,
    0
  );

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SHARK TEAM · OPERATIONS</p>
          <h1>Dashboard · Операционный центр</h1>
          <p className="admin-help">
            {month.label} · продажи, занятия, деньги и ученики, которым нужно внимание.
          </p>
        </div>
        <div className="admin-revenue">
          <span>Выручка за месяц</span>
          <strong>{formatAdminMoney(revenueMonth)}</strong>
        </div>
      </div>

      <section className="admin-metrics">
        <article className="admin-metric">
          <span>Лиды за месяц</span>
          <strong>{leadsMonth}</strong>
          <small>Всего: {leadsTotal}</small>
        </article>
        <article className="admin-metric">
          <span>Пробные посещены</span>
          <strong>{attendedTrialsMonth}</strong>
          <small>Ближайших подтверждено: {confirmedTrials}</small>
        </article>
        <article className="admin-metric">
          <span>Пробное → абонемент</span>
          <strong>{conversionRate === null ? "—" : conversionRate + "%"}</strong>
          <small>Зачислено: {enrolledFromTrialMonth}</small>
        </article>
        <article className="admin-metric">
          <span>Активные ученики</span>
          <strong>{activeStudents}</strong>
          <small>HOLD пробных: {trialHolds}</small>
        </article>
        <article className="admin-metric">
          <span>Посещаемость · 30 дней</span>
          <strong>{attendanceRate30 === null ? "—" : attendanceRate30 + "%"}</strong>
          <small>Отметок: {attendanceTotal30}</small>
        </article>
        <article className="admin-metric">
          <span>Заполненность групп</span>
          <strong>{fillRate === null ? "—" : fillRate + "%"}</strong>
          <small>{occupied}/{totalCapacity} · заполнено групп: {fullGroups}</small>
        </article>
        <article className="admin-metric">
          <span>Просрочено к оплате</span>
          <strong>{formatAdminMoney(unpaidDue._sum.amountUzs ?? 0)}</strong>
          <small>{unpaidDue._count} платежей</small>
        </article>
        <article className="admin-metric">
          <span>Открытые сигналы</span>
          <strong>{totalOpenAlerts}</strong>
          <small>В таблице показаны первые 15</small>
        </article>
        <article className="admin-metric">
          <span>Занятия сегодня</span>
          <strong>{sessionsToday}</strong>
          <small>
            <Link href="/admin/sessions?scope=today">Открыть Sessions →</Link>
          </small>
        </article>
        <article className="admin-metric">
          <span>Не завершены вовремя</span>
          <strong>{overdueSessions}</strong>
          <small>
            <Link href="/admin/sessions?scope=overdue">Проверить →</Link>
          </small>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Требует внимания</h2>
            <p className="admin-help">
              Системные сигналы закрываются автоматически после исправления причины.
            </p>
          </div>
          <div className="admin-page-actions">
            <Link className="admin-status" href="/admin/attendance">
              Посещаемость: {alertsByType.get("ATTENDANCE_RISK") ?? 0}
            </Link>
            <Link className="admin-status" href="/admin/progress">
              Прогресс: {alertsByType.get("PROGRESS_OVERDUE") ?? 0}
            </Link>
            <Link className="admin-status" href="/admin/subscriptions">
              Оплаты: {alertsByType.get("PAYMENT_ATTENTION") ?? 0}
            </Link>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Приоритет</th>
                <th>Сигнал</th>
                <th>Ученик</th>
                <th>Группа</th>
                <th>Детали</th>
                <th>Открыт</th>
              </tr>
            </thead>
            <tbody>
              {openAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td>
                    <span
                      className={
                        alert.severity === "critical"
                          ? "admin-attention"
                          : "admin-status"
                      }
                    >
                      {alert.severity === "critical" ? "Критический" : "Внимание"}
                    </span>
                  </td>
                  <td>
                    <Link href={alertLink(alert)}>
                      <strong>{alert.title}</strong>
                    </Link>
                  </td>
                  <td>{alert.child?.name ?? "—"}</td>
                  <td>{alert.group?.internalName ?? "—"}</td>
                  <td className="admin-wrap-cell">{alert.details ?? "—"}</td>
                  <td>{formatAdminDate(alert.openedAt)}</td>
                </tr>
              ))}
              {openAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6}>Открытых операционных сигналов нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Группы</h2>
          <Link className="admin-status" href="/admin/groups">
            Все группы →
          </Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Филиал</th>
                <th>Спорт</th>
                <th>Ученики</th>
                <th>Заполненность</th>
                <th>Свободно</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const groupFill = percent(
                  group._count.enrollments,
                  group.capacityRegular
                );
                return (
                  <tr key={group.id}>
                    <td>
                      <Link href={"/admin/groups/" + group.id}>
                        <strong>{group.internalName}</strong>
                      </Link>
                    </td>
                    <td>{group.branch.publicNameRu}</td>
                    <td>{group.sport.nameRu}</td>
                    <td>
                      {group._count.enrollments} / {group.capacityRegular}
                    </td>
                    <td>
                      {groupFill === null ? "—" : groupFill + "%"}
                    </td>
                    <td>
                      {Math.max(
                        0,
                        group.capacityRegular - group._count.enrollments
                      )}
                    </td>
                  </tr>
                );
              })}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6}>Активных групп пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Деньги за месяц</h2>
        </div>
        <div className="subscription-summary-grid">
          <div>
            <span>Пробные</span>
            <strong>{formatAdminMoney(paidTrialsMonth._sum.amountUzs ?? 0)}</strong>
            <small>{paidTrialsMonth._count} оплат</small>
          </div>
          <div>
            <span>Абонементы</span>
            <strong>
              {formatAdminMoney(paidSubscriptionsMonth._sum.amountUzs ?? 0)}
            </strong>
            <small>{paidSubscriptionsMonth._count} оплат</small>
          </div>
          <div>
            <span>Итого</span>
            <strong>{formatAdminMoney(revenueMonth)}</strong>
            <small>{paidTrialsMonth._count + paidSubscriptionsMonth._count} оплат</small>
          </div>
          <div>
            <span>Просрочено</span>
            <strong>{formatAdminMoney(unpaidDue._sum.amountUzs ?? 0)}</strong>
            <small>{unpaidDue._count} платежей</small>
          </div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Последние лиды</h2>
          <Link className="admin-status" href="/admin/leads">
            Все лиды →
          </Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Родитель</th>
                <th>Ребёнок</th>
                <th>Телефон</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatAdminDate(lead.createdAt)}</td>
                  <td>{lead.parentName}</td>
                  <td>
                    {lead.childName}, {lead.childAge}
                  </td>
                  <td>{lead.phone}</td>
                  <td>
                    <span className="admin-status">{lead.status}</span>
                  </td>
                </tr>
              ))}
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5}>Лидов пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
