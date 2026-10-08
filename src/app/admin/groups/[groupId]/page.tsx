import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AttendanceStatus,
  LifecycleStatus,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { GroupEditor } from "@/components/admin/group-editor";
import { GroupMemberManager } from "@/components/admin/group-member-manager";
import { RemoveFromGroupButton } from "@/components/admin/remove-from-group-button";
import { SessionAdminControls } from "@/components/admin/session-admin-controls";
import { SessionReopenControl } from "@/components/admin/session-reopen-control";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const weekday: Record<string, string> = {
  MONDAY: "Пн",
  TUESDAY: "Вт",
  WEDNESDAY: "Ср",
  THURSDAY: "Чт",
  FRIDAY: "Пт",
  SATURDAY: "Сб",
  SUNDAY: "Вс"
};

function time(minutes: number) {
  return (
    String(Math.floor(minutes / 60)).padStart(2, "0") +
    ":" +
    String(minutes % 60).padStart(2, "0")
  );
}

function formatSession(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent"
  }).format(value);
}

function formatSessionInput(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return (
    parts.year +
    "-" +
    parts.month +
    "-" +
    parts.day +
    "T" +
    parts.hour +
    ":" +
    parts.minute
  );
}

function percent(present: number, total: number) {
  return total ? Math.round((present / total) * 100) : null;
}

function dateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function AdminGroupPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const prisma = getPrisma();
  const currentDate = new Date();
  const now = currentDate.getTime();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const assessmentCutoff = new Date(now - 35 * 24 * 60 * 60 * 1000);
  const renewalCutoff = new Date(now + 7 * 24 * 60 * 60 * 1000);

  const [
    group,
    recentSessions,
    upcomingSessions,
    children,
    branches,
    sports,
    coaches
  ] = await Promise.all([
    prisma.trainingGroup.findUnique({
      where: { id: groupId },
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE },
          orderBy: { weekday: "asc" }
        },
        enrollments: {
          where: { status: StudentEnrollmentStatus.ACTIVE },
          include: {
            payments: {
              orderBy: { sequence: "desc" },
              take: 3
            },
            child: {
              include: {
                parent: true,
                progressAssessments: {
                  where: { groupId },
                  orderBy: { assessedAt: "desc" },
                  take: 1
                },
                attendances: {
                  where: {
                    trialBookingId: null,
                    session: {
                      groupId,
                      startsAt: { gte: since30, lte: currentDate }
                    }
                  },
                  include: { session: true },
                  orderBy: { session: { startsAt: "desc" } }
                }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    prisma.trainingSession.findMany({
      where: {
        groupId,
        startsAt: { gte: since30, lte: currentDate }
      },
      include: { attendances: true },
      orderBy: { startsAt: "desc" },
      take: 20
    }),
    prisma.trainingSession.findMany({
      where: {
        groupId,
        startsAt: { gte: currentDate },
        status: "SCHEDULED"
      },
      orderBy: { startsAt: "asc" },
      take: 10
    }),
    prisma.child.findMany({
      include: {
        parent: true,
        enrollments: {
          where: {
            status: {
              in: [
                StudentEnrollmentStatus.ACTIVE,
                StudentEnrollmentStatus.PAUSED
              ]
            }
          },
          include: {
            group: {
              include: {
                branch: true,
                sport: true
              }
            }
          }
        }
      },
      orderBy: { name: "asc" },
      take: 400
    }),
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: { publicNameRu: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    }),
    prisma.coach.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    })
  ]);

  if (!group) notFound();

  const memberIds = new Set(group.enrollments.map((item) => item.childId));
  const candidates = children
    .filter((child) => !memberIds.has(child.id))
    .map((child) => ({
      childId: child.id,
      name: child.name,
      parentName: child.parent.name,
      phone: child.parent.phone,
      enrollments: child.enrollments
        .filter((item) => item.groupId !== groupId)
        .map((item) => ({
          id: item.id,
          groupId: item.groupId,
          groupName: item.group.internalName,
          sport: item.group.sport.nameRu,
          branch: item.group.branch.publicNameRu
        }))
    }));

  const allAttendance = recentSessions.flatMap((session) =>
    session.attendances.filter((item) => item.trialBookingId === null)
  );
  const present = allAttendance.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const rate = percent(present, allAttendance.length);

  const studentRows = group.enrollments.map((enrollment) => {
    const attendance = enrollment.child.attendances;
    const present30 = attendance.filter(
      (item) => item.status === AttendanceStatus.PRESENT
    ).length;
    let consecutiveMisses = 0;

    for (const item of attendance) {
      if (item.status === AttendanceStatus.PRESENT) break;
      consecutiveMisses += 1;
    }

    const rate30 = percent(present30, attendance.length);
    const latestAssessment = enrollment.child.progressAssessments[0] ?? null;
    const assessmentStale =
      !latestAssessment || latestAssessment.assessedAt < assessmentCutoff;
    const paymentIssue =
      enrollment.subscriptionStatus === "PAYMENT_DUE" ||
      enrollment.subscriptionStatus === "PAST_DUE" ||
      enrollment.subscriptionStatus === "PAUSED";
    const expiring =
      Boolean(enrollment.currentPeriodEnd) &&
      enrollment.currentPeriodEnd! >= currentDate &&
      enrollment.currentPeriodEnd! <= renewalCutoff;
    const attendanceRisk =
      consecutiveMisses >= 2 ||
      (attendance.length >= 4 && (rate30 ?? 100) < 70);

    return {
      enrollment,
      rate30,
      consecutiveMisses,
      latestAssessment,
      assessmentStale,
      paymentIssue,
      expiring,
      attendanceRisk,
      paymentUnderReview: enrollment.payments.some(
        (payment) => payment.status === "UNDER_REVIEW"
      )
    };
  });

  const paymentIssues = studentRows.filter((row) => row.paymentIssue).length;
  const attendanceRisks = studentRows.filter((row) => row.attendanceRisk).length;
  const staleAssessments = studentRows.filter((row) => row.assessmentStale).length;
  const expiring = studentRows.filter((row) => row.expiring).length;
  const freePlaces = Math.max(
    0,
    group.capacityRegular - group.enrollments.length
  );

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">GROUP OPERATIONS</p>
          <h1>{group.internalName}</h1>
          <p className="admin-help">
            {group.sport.nameRu} · {group.branch.publicNameRu} ·{" "}
            {[group.primaryCoach.firstName, group.primaryCoach.lastName]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
        <Link className="admin-status" href="/admin/groups">
          ← Все группы
        </Link>
      </div>

      <div className="admin-metrics">
        <div className="admin-metric">
          <span>Ученики</span>
          <strong>
            {group.enrollments.length} / {group.capacityRegular}
          </strong>
        </div>
        <div className="admin-metric">
          <span>Свободные места</span>
          <strong>{freePlaces}</strong>
        </div>
        <div className="admin-metric">
          <span>Посещаемость · 30 дней</span>
          <strong>{rate === null ? "—" : rate + "%"}</strong>
        </div>
        <div className="admin-metric">
          <span>Проблемы оплаты</span>
          <strong>{paymentIssues}</strong>
        </div>
        <div className="admin-metric">
          <span>Риск по посещаемости</span>
          <strong>{attendanceRisks}</strong>
        </div>
        <div className="admin-metric">
          <span>Нужна оценка</span>
          <strong>{staleAssessments}</strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Настройки</p>
            <h2>Конфигурация группы</h2>
            <small>
              Филиал, спорт, тренер, набор, даты и расписание управляются здесь.
              Защищённые будущие занятия с бронями не удаляются автоматически.
            </small>
          </div>
        </div>

        <GroupEditor
          group={{
            id: group.id,
            branchId: group.branchId,
            sportId: group.sportId,
            primaryCoachId: group.primaryCoachId,
            internalName: group.internalName,
            ageMin: group.ageMin,
            ageMax: group.ageMax,
            capacityRegular: group.capacityRegular,
            capacityTrial: group.capacityTrial,
            status: group.status,
            enrollmentStatus: group.enrollmentStatus,
            level: group.level,
            notesInternal: group.notesInternal,
            startDate: dateValue(group.startDate),
            endDate: dateValue(group.endDate),
            schedule: group.scheduleRules.map((rule) => ({
              weekday: rule.weekday,
              start: time(rule.startMinutes),
              end: time(rule.endMinutes)
            }))
          }}
          branches={branches.map((branch) => ({
            id: branch.id,
            name: branch.publicNameRu
          }))}
          sports={sports.map((sport) => ({
            id: sport.id,
            name: sport.nameRu
          }))}
          coaches={coaches.map((coach) => ({
            id: coach.id,
            name: [coach.firstName, coach.lastName].filter(Boolean).join(" ")
          }))}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Расписание и ближайшая тренировка</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Регулярно</th>
                <td>
                  {group.scheduleRules
                    .map(
                      (rule) =>
                        weekday[rule.weekday] +
                        " " +
                        time(rule.startMinutes) +
                        "–" +
                        time(rule.endMinutes)
                    )
                    .join(" · ") || "—"}
                </td>
                <th>Следующая</th>
                <td>
                  {upcomingSessions[0]
                    ? formatSession(upcomingSessions[0].startsAt)
                    : "Не запланирована"}
                </td>
              </tr>
              <tr>
                <th>Возраст</th>
                <td>
                  {group.ageMin}–{group.ageMax}
                </td>
                <th>Набор / статус</th>
                <td>
                  {group.enrollmentStatus} · {group.status}
                </td>
              </tr>
              <tr>
                <th>Скоро продление</th>
                <td>{expiring}</td>
                <th>Тренер</th>
                <td>
                  {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Добавить или перевести ученика</h2>
          <p className="admin-help">
            Новый постоянный ученик должен иметь историю пробного/конверсии.
            Действующего ученика можно перевести или добавить как дополнительную секцию.
          </p>
        </div>
        <GroupMemberManager groupId={group.id} candidates={candidates} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Требуют внимания</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Оплата</th>
                <th>Посещаемость</th>
                <th>Пропуски подряд</th>
                <th>Оценка тренера</th>
                <th>Продление</th>
              </tr>
            </thead>
            <tbody>
              {studentRows
                .filter(
                  (row) =>
                    row.paymentIssue ||
                    row.attendanceRisk ||
                    row.assessmentStale ||
                    row.expiring
                )
                .map((row) => (
                  <tr key={row.enrollment.id}>
                    <td>
                      <Link href={"/admin/children/" + row.enrollment.childId}>
                        <strong>{row.enrollment.child.name}</strong>
                      </Link>
                    </td>
                    <td>
                      {row.paymentIssue ? (
                        <span className="admin-attention">
                          {row.enrollment.subscriptionStatus}
                        </span>
                      ) : (
                        <span className="admin-status">OK</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          row.attendanceRisk ? "admin-attention" : "admin-status"
                        }
                      >
                        {row.rate30 === null ? "—" : row.rate30 + "%"}
                      </span>
                    </td>
                    <td>{row.consecutiveMisses}</td>
                    <td>
                      {row.assessmentStale ? (
                        <span className="admin-attention">
                          {row.latestAssessment
                            ? formatAdminDate(row.latestAssessment.assessedAt)
                            : "Нет оценки"}
                        </span>
                      ) : row.latestAssessment ? (
                        formatAdminDate(row.latestAssessment.assessedAt)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.expiring && row.enrollment.currentPeriodEnd ? (
                        <span className="admin-attention">
                          {formatAdminDate(row.enrollment.currentPeriodEnd)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              {!studentRows.some(
                (row) =>
                  row.paymentIssue ||
                  row.attendanceRisk ||
                  row.assessmentStale ||
                  row.expiring
              ) ? (
                <tr>
                  <td colSpan={6}>Сейчас группа не требует внимания.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Состав группы</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Родитель</th>
                <th>Абонемент</th>
                <th>Оплачено до</th>
                <th>30 дней</th>
                <th>Последняя оценка</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((row) => (
                <tr key={row.enrollment.id}>
                  <td>
                    <Link href={"/admin/children/" + row.enrollment.childId}>
                      <strong>{row.enrollment.child.name}</strong>
                    </Link>
                  </td>
                  <td>
                    {row.enrollment.child.parent.name}
                    <br />
                    <small>{row.enrollment.child.parent.phone}</small>
                  </td>
                  <td>
                    {row.enrollment.subscriptionStatus ?? row.enrollment.status}
                  </td>
                  <td>
                    {row.enrollment.currentPeriodEnd
                      ? formatAdminDate(row.enrollment.currentPeriodEnd)
                      : "—"}
                  </td>
                  <td>{row.rate30 === null ? "—" : row.rate30 + "%"}</td>
                  <td>
                    {row.latestAssessment
                      ? formatAdminDate(row.latestAssessment.assessedAt)
                      : "Нужна оценка"}
                  </td>
                  <td>
                    <RemoveFromGroupButton
                      enrollmentId={row.enrollment.id}
                      childName={row.enrollment.child.name}
                      paymentUnderReview={row.paymentUnderReview}
                    />
                  </td>
                </tr>
              ))}
              {!studentRows.length ? (
                <tr>
                  <td colSpan={7}>Активных учеников пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Ближайшие тренировки</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Статус</th>
                <th>Вместимость</th>
                <th>Пробные места</th>
                <th>Управление</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSessions.map((session) => (
                <tr key={session.id}>
                  <td>{formatSession(session.startsAt)}</td>
                  <td>{session.status}</td>
                  <td>{session.regularCapacity}</td>
                  <td>{session.trialCapacity ?? "—"}</td>
                  <td>
                    <SessionAdminControls
                      session={{
                        id: session.id,
                        startsAt: formatSessionInput(session.startsAt),
                        endsAt: formatSessionInput(session.endsAt)
                      }}
                    />
                  </td>
                </tr>
              ))}
              {!upcomingSessions.length ? (
                <tr>
                  <td colSpan={5}>Ближайших тренировок нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Последние занятия</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статус</th>
                <th>Отмечено</th>
                <th>Присутствовали</th>
                <th>Отсутствовали</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((session) => {
                const regular = session.attendances.filter(
                  (item) => item.trialBookingId === null
                );
                return (
                  <tr key={session.id}>
                    <td>{formatSession(session.startsAt)}</td>
                    <td>{session.status}</td>
                    <td>{regular.length}</td>
                    <td>
                      {
                        regular.filter(
                          (item) => item.status === AttendanceStatus.PRESENT
                        ).length
                      }
                    </td>
                    <td>
                      {
                        regular.filter(
                          (item) => item.status !== AttendanceStatus.PRESENT
                        ).length
                      }
                    </td>
                    <td>
                      {session.status === "COMPLETED" ? (
                        <SessionReopenControl sessionId={session.id} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {!recentSessions.length ? (
                <tr>
                  <td colSpan={6}>Занятий за последние 30 дней нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
