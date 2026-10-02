import Link from "next/link";
import {
  LifecycleStatus,
  SessionStatus
} from "@/generated/prisma/client";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";
import {
  dateKeyInTimeZone,
  localDateTimeToUtc
} from "@/lib/timezone";
import { getAdminSessions } from "@/server/sessions/admin-session-overview";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Asia/Tashkent";

function stringParam(
  value: string | string[] | undefined
) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    UPCOMING: "Запланировано",
    IN_PROGRESS: "Идёт сейчас",
    OVERDUE: "Не завершено вовремя",
    COMPLETED: "Завершено",
    CANCELLED: "Отменено"
  };

  return labels[value] ?? value;
}

function statusClass(value: string) {
  return value === "OVERDUE"
    ? "admin-attention"
    : value === "COMPLETED"
      ? "admin-status"
      : value === "CANCELLED"
        ? "admin-attention"
        : "admin-status";
}

function coachName(coach: {
  firstName: string;
  lastName: string | null;
}) {
  return [coach.firstName, coach.lastName]
    .filter(Boolean)
    .join(" ");
}

function scopeHref(
  scope: string,
  filters: Record<string, string>
) {
  const query = new URLSearchParams();
  query.set("scope", scope);

  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }

  return "/admin/sessions?" + query.toString();
}

export default async function AdminSessionsPage({
  searchParams
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const params = await searchParams;
  const scope = stringParam(params.scope) || "today";
  const branchId = stringParam(params.branchId);
  const sportId = stringParam(params.sportId);
  const groupId = stringParam(params.groupId);
  const coachId = stringParam(params.coachId);

  const prisma = getPrisma();
  const now = new Date();
  const todayKey = dateKeyInTimeZone(now, TIME_ZONE);
  const [year, month, day] = todayKey.split("-").map(Number);
  const tomorrowDate = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowKey =
    String(tomorrowDate.getUTCFullYear()).padStart(4, "0") +
    "-" +
    String(tomorrowDate.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(tomorrowDate.getUTCDate()).padStart(2, "0");

  const todayStart = localDateTimeToUtc(todayKey, 0, 0, TIME_ZONE);
  const tomorrowStart = localDateTimeToUtc(
    tomorrowKey,
    0,
    0,
    TIME_ZONE
  );

  const [
    rows,
    branches,
    sports,
    groups,
    coaches,
    todayTotal,
    todayCompleted,
    todayCancelled,
    overdueTotal,
    inProgressTotal
  ] = await Promise.all([
    getAdminSessions({
      scope,
      branchId: branchId || null,
      sportId: sportId || null,
      groupId: groupId || null,
      coachId: coachId || null,
      now,
      todayStart,
      tomorrowStart,
      take: 500
    }),
    prisma.branch.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      orderBy: { publicNameRu: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    }),
    prisma.trainingGroup.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      include: {
        branch: true,
        sport: true
      },
      orderBy: { internalName: "asc" }
    }),
    prisma.coach.findMany({
      where: { status: LifecycleStatus.ACTIVE },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    }),
    prisma.trainingSession.count({
      where: {
        startsAt: { gte: todayStart, lt: tomorrowStart }
      }
    }),
    prisma.trainingSession.count({
      where: {
        status: SessionStatus.COMPLETED,
        startsAt: { gte: todayStart, lt: tomorrowStart }
      }
    }),
    prisma.trainingSession.count({
      where: {
        status: SessionStatus.CANCELLED,
        startsAt: { gte: todayStart, lt: tomorrowStart }
      }
    }),
    prisma.trainingSession.count({
      where: {
        status: SessionStatus.SCHEDULED,
        endsAt: { lt: now }
      }
    }),
    prisma.trainingSession.count({
      where: {
        status: SessionStatus.SCHEDULED,
        startsAt: { lte: now },
        endsAt: { gte: now }
      }
    })
  ]);

  const filters = { branchId, sportId, groupId, coachId };
  const scopes = [
    ["today", "Сегодня"],
    ["upcoming", "Будущие"],
    ["overdue", "Не завершены"],
    ["completed", "Завершённые"],
    ["cancelled", "Отменённые"],
    ["all", "Все"]
  ] as const;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">OPERATIONS · SESSIONS</p>
          <h1>Занятия</h1>
          <p className="admin-help">
            Единый экран всех тренировок: расписание, отметки,
            пробники, завершение и исключения.
          </p>
        </div>
        <span className="admin-count">{rows.length} занятий</span>
      </div>

      <section className="admin-metrics">
        <article className="admin-metric">
          <span>Сегодня</span>
          <strong>{todayTotal}</strong>
        </article>
        <article className="admin-metric">
          <span>Идут сейчас</span>
          <strong>{inProgressTotal}</strong>
        </article>
        <article className="admin-metric">
          <span>Не завершены вовремя</span>
          <strong>{overdueTotal}</strong>
        </article>
        <article className="admin-metric">
          <span>Завершены сегодня</span>
          <strong>{todayCompleted}</strong>
        </article>
        <article className="admin-metric">
          <span>Отменены сегодня</span>
          <strong>{todayCancelled}</strong>
        </article>
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Фильтры</h2>
            <p className="admin-help">
              Филиал, вид спорта, группа и тренер можно комбинировать.
            </p>
          </div>
        </div>

        <form className="admin-session-filters" method="get">
          <input type="hidden" name="scope" value={scope} />

          <label className="admin-field">
            <span>Филиал</span>
            <select name="branchId" defaultValue={branchId}>
              <option value="">Все филиалы</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.publicNameRu}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Вид спорта</span>
            <select name="sportId" defaultValue={sportId}>
              <option value="">Все виды спорта</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.nameRu}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Группа</span>
            <select name="groupId" defaultValue={groupId}>
              <option value="">Все группы</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.internalName} · {group.branch.publicNameRu}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Тренер</span>
            <select name="coachId" defaultValue={coachId}>
              <option value="">Все тренеры</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coachName(coach)}
                </option>
              ))}
            </select>
          </label>

          <div className="subscription-action-row admin-session-filter-actions">
            <button className="button primary" type="submit">
              Применить
            </button>
            <Link className="button" href={"/admin/sessions?scope=" + scope}>
              Сбросить
            </Link>
          </div>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-page-actions">
          {scopes.map(([value, label]) => (
            <Link
              key={value}
              className={
                scope === value ? "admin-attention" : "admin-status"
              }
              href={scopeHref(value, filters)}
            >
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Тренировка</th>
                <th>Группа</th>
                <th>Тренер</th>
                <th>Состояние</th>
                <th>Отмечено</th>
                <th>П / Н / У</th>
                <th>Посещаемость</th>
                <th>Пробники</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.session.id}>
                  <td>
                    <Link href={"/admin/sessions/" + row.session.id}>
                      <strong>{formatAdminDate(row.session.startsAt)}</strong>
                    </Link>
                    <br />
                    <small>
                      {row.session.group.branch.publicNameRu}
                    </small>
                  </td>
                  <td>
                    <Link href={"/admin/groups/" + row.session.groupId}>
                      {row.session.group.internalName}
                    </Link>
                    <br />
                    <small>{row.session.group.sport.nameRu}</small>
                  </td>
                  <td>{coachName(row.session.coach)}</td>
                  <td>
                    <span className={statusClass(row.operationalState)}>
                      {statusLabel(row.operationalState)}
                    </span>
                    {row.operationalState === "OVERDUE" ? (
                      <>
                        <br />
                        <small>
                          Закончилось {formatAdminDate(row.session.endsAt)}
                        </small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <strong>
                      {row.marked}/{row.expected}
                    </strong>
                  </td>
                  <td>
                    {row.present} / {row.absent} / {row.excused}
                  </td>
                  <td>
                    {row.attendanceRate === null
                      ? "—"
                      : row.attendanceRate + "%"}
                  </td>
                  <td>{row.trials}</td>
                  <td>
                    <Link
                      className="admin-status"
                      href={"/admin/sessions/" + row.session.id}
                    >
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    По выбранным фильтрам занятий нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
