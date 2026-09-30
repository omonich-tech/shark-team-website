import Link from "next/link";
import {
  AttendanceStatus,
  OperationalAlertStatus,
  OperationalAlertType,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";
import { absenceReasonLabel } from "@/server/attendance/absence-reason";

export const dynamic = "force-dynamic";

function percent(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

export default async function AdminAttendancePage() {
  const prisma = getPrisma();
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: {
        include: {
          parent: true,
          attendances: {
            where: {
              trialBookingId: null,
              session: {
                startsAt: {
                  gte: since90
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
            }
          }
        }
      },
      group: {
        include: {
          branch: true,
          sport: true
        }
      },
      operationalAlerts: {
        where: {
          type: OperationalAlertType.ATTENDANCE_RISK,
          status: OperationalAlertStatus.OPEN
        },
        take: 1
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 300
  });

  const rows = enrollments.map((enrollment) => {
    const attendance = enrollment.child.attendances;
    const attendance30 = attendance.filter(
      (item) => item.session.startsAt >= since30
    );
    const present = attendance.filter(
      (item) => item.status === AttendanceStatus.PRESENT
    ).length;
    const absent = attendance.filter(
      (item) => item.status === AttendanceStatus.ABSENT
    ).length;
    const excused = attendance.filter(
      (item) => item.status === AttendanceStatus.EXCUSED
    ).length;
    const present30 = attendance30.filter(
      (item) => item.status === AttendanceStatus.PRESENT
    ).length;

    let consecutiveMisses = 0;
    for (const item of attendance) {
      if (item.status === AttendanceStatus.PRESENT) break;
      consecutiveMisses += 1;
    }

    const lastAbsence = attendance.find(
      (item) => item.status !== AttendanceStatus.PRESENT
    );

    return {
      enrollment,
      total: attendance.length,
      present,
      absent,
      excused,
      rate90: percent(present, attendance.length),
      rate30: percent(present30, attendance30.length),
      consecutiveMisses,
      lastAbsence,
      latest: attendance[0] ?? null,
      unknownReasons: attendance.filter(
        (item) =>
          item.status !== AttendanceStatus.PRESENT &&
          !item.absenceReason
      ).length,
      alert: enrollment.operationalAlerts[0] ?? null
    };
  });

  const all = rows.flatMap((row) => row.enrollment.child.attendances);
  const totalMarked = all.length;
  const totalPresent = all.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const totalMisses = all.filter(
    (item) => item.status !== AttendanceStatus.PRESENT
  ).length;
  const attention = rows.filter((row) => Boolean(row.alert)).length;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">OPERATIONS</p>
          <h1>Посещаемость</h1>
          <p className="admin-help">
            Постоянные ученики · статистика за последние 90 дней.
          </p>
        </div>
        <span className="admin-count">{rows.length} учеников</span>
      </div>

      <section className="admin-metrics">
        <article className="admin-metric">
          <span>Отмечено посещений</span>
          <strong>{totalMarked}</strong>
        </article>
        <article className="admin-metric">
          <span>Общая посещаемость</span>
          <strong>
            {totalMarked > 0
              ? Math.round((totalPresent / totalMarked) * 100) + "%"
              : "—"}
          </strong>
        </article>
        <article className="admin-metric">
          <span>Пропусков</span>
          <strong>{totalMisses}</strong>
        </article>
        <article className="admin-metric">
          <span>Требуют внимания</span>
          <strong>{attention}</strong>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Группа</th>
                <th>30 дней</th>
                <th>90 дней</th>
                <th>П / Н / У</th>
                <th>Подряд пропущено</th>
                <th>Последний пропуск</th>
                <th>Без причины</th>
                <th>Системный сигнал</th>
                <th>Последняя отметка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const warning =
                  row.consecutiveMisses >= 2 ||
                  (row.total >= 4 && (row.rate90 ?? 100) < 70);

                return (
                  <tr key={row.enrollment.id}>
                    <td>
                      <Link href={"/admin/children/" + row.enrollment.childId}>
                        <strong>{row.enrollment.child.name}</strong>
                      </Link>
                      <br />
                      <small>
                        {row.enrollment.child.parent.name} ·{" "}
                        {row.enrollment.child.parent.phone}
                      </small>
                    </td>
                    <td>
                      {row.enrollment.group.internalName}
                      <br />
                      <small>
                        {row.enrollment.group.sport.nameRu} ·{" "}
                        {row.enrollment.group.branch.publicNameRu}
                      </small>
                    </td>
                    <td>
                      <span className={warning ? "admin-attention" : "admin-status"}>
                        {row.rate30 === null ? "—" : row.rate30 + "%"}
                      </span>
                    </td>
                    <td>{row.rate90 === null ? "—" : row.rate90 + "%"}</td>
                    <td>
                      {row.present} / {row.absent} / {row.excused}
                    </td>
                    <td>
                      {row.consecutiveMisses >= 2 ? (
                        <span className="admin-attention">
                          {row.consecutiveMisses}
                        </span>
                      ) : (
                        row.consecutiveMisses
                      )}
                    </td>
                    <td>
                      {row.lastAbsence ? (
                        <>
                          {row.lastAbsence.absenceReason
                            ? absenceReasonLabel(
                                row.lastAbsence.absenceReason,
                                "ru"
                              )
                            : "Причина не указана"}
                          <br />
                          <small>
                            {formatAdminDate(row.lastAbsence.session.startsAt)}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{row.unknownReasons}</td>
                    <td>
                      {row.alert ? (
                        <>
                          <span className="admin-attention">
                            {row.alert.severity === "critical"
                              ? "Критический"
                              : "Требует внимания"}
                          </span>
                          <br />
                          <small>{row.alert.details ?? "Риск посещаемости"}</small>
                        </>
                      ) : (
                        <span className="admin-status">Нет</span>
                      )}
                    </td>
                    <td>
                      {row.latest
                        ? formatAdminDate(row.latest.session.startsAt)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10}>Активных учеников пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
