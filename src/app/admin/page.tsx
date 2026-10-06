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
  dayRangeInTimeZone
} from "@/lib/timezone";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Asia/Tashkent";
const DAY = 24 * 60 * 60 * 1000;
const RANGE_OPTIONS = [7, 30, 90] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number];
type SearchParams = Promise<{ range?: string | string[] }>;

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function resolveRange(value: string | undefined): RangeDays {
  const parsed = Number(value);
  return RANGE_OPTIONS.includes(parsed as RangeDays)
    ? (parsed as RangeDays)
    : 30;
}

function compactMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(amount);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

function severityLabel(value: string) {
  return value === "critical" ? "Критично" : "Внимание";
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const params = await searchParams;
  const rangeDays = resolveRange(singleParam(params.range));
  const today = dayRangeInTimeZone(now, TIME_ZONE);
  const rangeStart = new Date(today.start.getTime() - (rangeDays - 1) * DAY);
  const rangeEnd = today.end;
  const since30 = new Date(today.start.getTime() - 29 * DAY);

  const [
    leads,
    trialBookings,
    paidTrials,
    paidSubscriptions,
    enrolledConversions,
    activeStudents,
    unpaidDue,
    attendanceTotal30,
    attendancePresent30,
    groups,
    branches,
    sports,
    openAlerts,
    recentLeads,
    sessionsToday
  ] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: {
        id: true,
        createdAt: true,
        parentName: true,
        childName: true,
        childAge: true,
        phone: true,
        status: true,
        source: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.trialBooking.findMany({
      where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
      select: {
        id: true,
        createdAt: true,
        status: true,
        session: { select: { startsAt: true } }
      }
    }),
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: rangeStart, lt: rangeEnd }
      },
      select: { amountUzs: true, paidAt: true }
    }),
    prisma.subscriptionPayment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: rangeStart, lt: rangeEnd }
      },
      select: { amountUzs: true, paidAt: true }
    }),
    prisma.trialConversion.findMany({
      where: {
        status: TrialConversionStatus.ENROLLED,
        enrolledAt: { gte: rangeStart, lt: rangeEnd }
      },
      select: { enrolledAt: true }
    }),
    prisma.studentEnrollment.count({
      where: { status: StudentEnrollmentStatus.ACTIVE }
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
        session: { startsAt: { gte: since30, lte: now } }
      }
    }),
    prisma.attendance.count({
      where: {
        trialBookingId: null,
        status: AttendanceStatus.PRESENT,
        session: { startsAt: { gte: since30, lte: now } }
      }
    }),
    prisma.trainingGroup.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
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
    prisma.branch.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        groups: {
          where: { status: LifecycleStatus.ACTIVE },
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: StudentEnrollmentStatus.ACTIVE }
                }
              }
            }
          }
        }
      },
      orderBy: { publicNameRu: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        groups: {
          where: { status: LifecycleStatus.ACTIVE },
          include: {
            _count: {
              select: {
                enrollments: {
                  where: { status: StudentEnrollmentStatus.ACTIVE }
                }
              }
            }
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    }),
    prisma.operationalAlert.findMany({
      where: { status: OperationalAlertStatus.OPEN },
      include: {
        child: true,
        group: true
      },
      orderBy: [{ severity: "asc" }, { openedAt: "asc" }],
      take: 6
    }),
    prisma.lead.findMany({
      take: 6,
      orderBy: { createdAt: "desc" }
    }),
    prisma.trainingSession.findMany({
      where: {
        startsAt: { gte: today.start, lt: today.end }
      },
      include: {
        group: {
          include: {
            branch: true,
            sport: true
          }
        },
        coach: true,
        _count: {
          select: {
            trialBookings: true,
            attendances: true
          }
        }
      },
      orderBy: { startsAt: "asc" },
      take: 8
    })
  ]);

  const attendedTrials = trialBookings.filter(
    (booking) =>
      booking.status === TrialBookingStatus.ATTENDED &&
      booking.session.startsAt >= rangeStart &&
      booking.session.startsAt < rangeEnd
  ).length;
  const confirmedTrials = trialBookings.filter(
    (booking) => booking.status === TrialBookingStatus.CONFIRMED
  ).length;
  const pendingTrials = trialBookings.filter((booking) =>
    [TrialBookingStatus.HOLD, TrialBookingStatus.PAYMENT_PENDING].includes(
      booking.status
    )
  ).length;

  const paidTrialRevenue = paidTrials.reduce(
    (sum, payment) => sum + payment.amountUzs,
    0
  );
  const subscriptionRevenue = paidSubscriptions.reduce(
    (sum, payment) => sum + payment.amountUzs,
    0
  );
  const revenue = paidTrialRevenue + subscriptionRevenue;
  const paidCount = paidTrials.length + paidSubscriptions.length;
  const conversionRate = percent(enrolledConversions.length, leads.length);
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

  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY);
    return {
      key: dateKeyInTimeZone(date, TIME_ZONE),
      date,
      leads: 0,
      trials: 0,
      payments: 0,
      enrollments: 0
    };
  });
  const dayMap = new Map(days.map((day) => [day.key, day]));

  leads.forEach((lead) => {
    const day = dayMap.get(dateKeyInTimeZone(lead.createdAt, TIME_ZONE));
    if (day) day.leads += 1;
  });
  trialBookings.forEach((booking) => {
    const day = dayMap.get(dateKeyInTimeZone(booking.createdAt, TIME_ZONE));
    if (day) day.trials += 1;
  });
  [...paidTrials, ...paidSubscriptions].forEach((payment) => {
    if (!payment.paidAt) return;
    const day = dayMap.get(dateKeyInTimeZone(payment.paidAt, TIME_ZONE));
    if (day) day.payments += 1;
  });
  enrolledConversions.forEach((conversion) => {
    if (!conversion.enrolledAt) return;
    const day = dayMap.get(
      dateKeyInTimeZone(conversion.enrolledAt, TIME_ZONE)
    );
    if (day) day.enrollments += 1;
  });

  const chartDays =
    rangeDays <= 30
      ? days
      : days.filter((_, index) => index % 3 === 0 || index === days.length - 1);
  const chartMax = Math.max(
    1,
    ...chartDays.flatMap((day) => [
      day.leads,
      day.trials,
      day.payments,
      day.enrollments
    ])
  );

  const branchCards = branches.map((branch) => {
    const capacity = branch.groups.reduce(
      (sum, group) => sum + group.capacityRegular,
      0
    );
    const students = branch.groups.reduce(
      (sum, group) => sum + group._count.enrollments,
      0
    );
    return {
      id: branch.id,
      name: branch.publicNameRu,
      groups: branch.groups.length,
      capacity,
      students,
      fill: percent(students, capacity)
    };
  });

  const sportCards = sports.map((sport) => {
    const capacity = sport.groups.reduce(
      (sum, group) => sum + group.capacityRegular,
      0
    );
    const students = sport.groups.reduce(
      (sum, group) => sum + group._count.enrollments,
      0
    );
    return {
      id: sport.id,
      name: sport.nameRu,
      groups: sport.groups.length,
      students,
      capacity,
      fill: percent(students, capacity)
    };
  });

  const funnel = [
    { label: "Лиды", value: leads.length },
    { label: "Пробные", value: trialBookings.length },
    { label: "Оплаты", value: paidCount },
    { label: "Посетили", value: attendedTrials },
    { label: "Зачислены", value: enrolledConversions.length }
  ];
  const funnelBase = Math.max(1, funnel[0].value);

  return (
    <div className="shark-dashboard">
      <header className="shark-dashboard-head">
        <div>
          <p className="eyebrow">SHARK TEAM · CONTROL CENTER</p>
          <h1>Dashboard</h1>
          <p className="admin-help">
            Реальные показатели CRM, тренировок и финансов.
          </p>
        </div>

        <div className="dashboard-range" aria-label="Период Dashboard">
          {RANGE_OPTIONS.map((option) => (
            <Link
              className={rangeDays === option ? "active" : undefined}
              href={"/admin?range=" + option}
              key={option}
            >
              {option} дней
            </Link>
          ))}
        </div>
      </header>

      <section className="dashboard-kpi-grid">
        <article className="dashboard-kpi-card featured">
          <div className="dashboard-kpi-top">
            <span>Выручка</span>
            <em>{rangeDays} дней</em>
          </div>
          <strong>{formatAdminMoney(revenue)}</strong>
          <small>
            Пробные {compactMoney(paidTrialRevenue)} · Абонементы{" "}
            {compactMoney(subscriptionRevenue)}
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Активные ученики</span>
            <em>сейчас</em>
          </div>
          <strong>{activeStudents}</strong>
          <small>{occupied} мест занято в активных группах</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Новые лиды</span>
            <em>{rangeDays} дней</em>
          </div>
          <strong>{leads.length}</strong>
          <small>Конверсия в ученика {conversionRate ?? 0}%</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Пробные</span>
            <em>{rangeDays} дней</em>
          </div>
          <strong>{trialBookings.length}</strong>
          <small>
            {confirmedTrials} подтверждено · {pendingTrials} ожидают
          </small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Заполненность</span>
            <em>группы</em>
          </div>
          <strong>{fillRate ?? 0}%</strong>
          <small>{occupied} / {totalCapacity} мест</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Посещаемость</span>
            <em>30 дней</em>
          </div>
          <strong>{attendanceRate30 ?? 0}%</strong>
          <small>{attendancePresent30} из {attendanceTotal30} отметок</small>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-card dashboard-trend-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Динамика</p>
              <h2>Воронка по дням</h2>
            </div>
            <div className="dashboard-legend">
              <span><i className="lead" />Лиды</span>
              <span><i className="trial" />Пробные</span>
              <span><i className="payment" />Оплаты</span>
              <span><i className="enrollment" />Зачисления</span>
            </div>
          </div>

          <div className="dashboard-chart">
            {chartDays.map((day, index) => (
              <div className="dashboard-chart-day" key={day.key}>
                <div className="dashboard-chart-bars">
                  <i
                    className="lead"
                    style={{ height: `${Math.max(4, (day.leads / chartMax) * 100)}%`, animationDelay: `${index * 18}ms` }}
                    title={`Лиды: ${day.leads}`}
                  />
                  <i
                    className="trial"
                    style={{ height: `${Math.max(4, (day.trials / chartMax) * 100)}%`, animationDelay: `${index * 18 + 30}ms` }}
                    title={`Пробные: ${day.trials}`}
                  />
                  <i
                    className="payment"
                    style={{ height: `${Math.max(4, (day.payments / chartMax) * 100)}%`, animationDelay: `${index * 18 + 60}ms` }}
                    title={`Оплаты: ${day.payments}`}
                  />
                  <i
                    className="enrollment"
                    style={{ height: `${Math.max(4, (day.enrollments / chartMax) * 100)}%`, animationDelay: `${index * 18 + 90}ms` }}
                    title={`Зачисления: ${day.enrollments}`}
                  />
                </div>
                <small>{dayLabel(day.date)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card dashboard-funnel-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Конверсия</p>
              <h2>Путь клиента</h2>
            </div>
          </div>

          <div className="dashboard-funnel">
            {funnel.map((step) => {
              const share = percent(step.value, funnelBase) ?? 0;
              return (
                <div className="dashboard-funnel-step" key={step.label}>
                  <div>
                    <span>{step.label}</span>
                    <strong>{step.value}</strong>
                  </div>
                  <div className="dashboard-funnel-track">
                    <i style={{ width: `${Math.max(step.value ? 10 : 0, share)}%` }} />
                  </div>
                  <small>{share}% от лидов</small>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-work-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Сегодня</p>
              <h2>Занятия</h2>
            </div>
            <Link href="/admin/sessions?scope=today">Все →</Link>
          </div>

          <div className="dashboard-session-list">
            {sessionsToday.map((session) => (
              <Link
                className="dashboard-session-row"
                href={"/admin/sessions/" + session.id}
                key={session.id}
              >
                <time>{timeLabel(session.startsAt)}</time>
                <div>
                  <strong>{session.group.sport.nameRu}</strong>
                  <span>{session.group.internalName} · {session.group.branch.publicNameRu}</span>
                </div>
                <div className="dashboard-session-meta">
                  <span>
                    {[session.coach.firstName, session.coach.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </span>
                  <small>
                    {session._count.attendances} отмечено · {session._count.trialBookings} пробных
                  </small>
                </div>
              </Link>
            ))}
            {sessionsToday.length === 0 ? (
              <div className="dashboard-empty">Сегодня занятий нет.</div>
            ) : null}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Контроль</p>
              <h2>Требует внимания</h2>
            </div>
            <span className="dashboard-counter">{openAlerts.length}</span>
          </div>

          <div className="dashboard-alert-list">
            {openAlerts.map((alert) => (
              <Link
                className="dashboard-alert-row"
                href={alertLink(alert)}
                key={alert.id}
              >
                <i className={alert.severity === "critical" ? "critical" : ""} />
                <div>
                  <strong>{alert.title}</strong>
                  <span>
                    {alert.child?.name ?? alert.group?.internalName ?? "Система"}
                  </span>
                </div>
                <small>{severityLabel(alert.severity)}</small>
              </Link>
            ))}
            {openAlerts.length === 0 ? (
              <div className="dashboard-empty">Открытых сигналов нет.</div>
            ) : null}
          </div>

          <div className="dashboard-finance-warning">
            <span>Просрочено к оплате</span>
            <strong>{formatAdminMoney(unpaidDue._sum.amountUzs ?? 0)}</strong>
            <small>{unpaidDue._count} платежей</small>
          </div>
        </article>
      </section>

      <section className="dashboard-entity-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Сеть</p>
              <h2>Филиалы</h2>
            </div>
            <Link href="/admin/branches">Управление →</Link>
          </div>
          <div className="dashboard-rank-list">
            {branchCards.map((branch) => (
              <Link href={"/admin/branches/" + branch.id} key={branch.id}>
                <div className="dashboard-rank-title">
                  <strong>{branch.name}</strong>
                  <span>{branch.students} учеников · {branch.groups} групп</span>
                </div>
                <div className="dashboard-progress">
                  <i style={{ width: `${branch.fill ?? 0}%` }} />
                </div>
                <small>{branch.fill ?? 0}% заполнено</small>
              </Link>
            ))}
            {branchCards.length === 0 ? (
              <div className="dashboard-empty">Активных филиалов пока нет.</div>
            ) : null}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Направления</p>
              <h2>Виды спорта</h2>
            </div>
            <Link href="/admin/sports">Управление →</Link>
          </div>
          <div className="dashboard-rank-list">
            {sportCards.map((sport) => (
              <div key={sport.id}>
                <div className="dashboard-rank-title">
                  <strong>{sport.name}</strong>
                  <span>{sport.students} учеников · {sport.groups} групп</span>
                </div>
                <div className="dashboard-progress">
                  <i style={{ width: `${sport.fill ?? 0}%` }} />
                </div>
                <small>{sport.fill ?? 0}% заполнено</small>
              </div>
            ))}
            {sportCards.length === 0 ? (
              <div className="dashboard-empty">Активных направлений пока нет.</div>
            ) : null}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">CRM</p>
              <h2>Последние лиды</h2>
            </div>
            <Link href="/admin/leads">Все →</Link>
          </div>

          <div className="dashboard-lead-list">
            {recentLeads.map((lead) => (
              <div className="dashboard-lead-row" key={lead.id}>
                <div>
                  <strong>{lead.parentName}</strong>
                  <span>{lead.childName}, {lead.childAge} лет</span>
                </div>
                <div>
                  <span>{lead.phone}</span>
                  <small>{formatAdminDate(lead.createdAt)}</small>
                </div>
                <em>{lead.status}</em>
              </div>
            ))}
            {recentLeads.length === 0 ? (
              <div className="dashboard-empty">Лидов пока нет.</div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="dashboard-analytics-placeholder">
        <div>
          <p className="admin-panel-kicker">WEB ANALYTICS</p>
          <h2>Посетители сайта, MAU/WAU/DAU, клики и источники</h2>
          <p>
            Этот блок подключим следующим этапом. Здесь будут только реальные
            данные после установки аналитики — без выдуманных показателей.
          </p>
        </div>
        <span>Следующий модуль</span>
      </section>
    </div>
  );
}
