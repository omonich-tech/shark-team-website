import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionStatus } from "@/generated/prisma/client";
import { SessionAdminControls } from "@/components/admin/session-admin-controls";
import { SessionReopenControl } from "@/components/admin/session-reopen-control";
import { formatAdminDate } from "@/lib/admin-format";
import { getAdminSessionDetail } from "@/server/sessions/admin-session-overview";

export const dynamic = "force-dynamic";

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

function stateLabel(value: string) {
  const labels: Record<string, string> = {
    UPCOMING: "Запланировано",
    IN_PROGRESS: "Идёт сейчас",
    OVERDUE: "Не завершено вовремя",
    COMPLETED: "Завершено",
    CANCELLED: "Отменено"
  };

  return labels[value] ?? value;
}

function attendanceLabel(value: string | null) {
  const labels: Record<string, string> = {
    PRESENT: "Присутствует",
    ABSENT: "Отсутствует",
    EXCUSED: "Уважительная"
  };

  return value ? labels[value] ?? value : "Не отмечен";
}

function sourceLabel(value: "REGULAR" | "TRIAL") {
  return value === "TRIAL" ? "Пробное" : "Постоянный";
}

export default async function AdminSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const now = new Date();
  const data = await getAdminSessionDetail(sessionId, now);

  if (!data) notFound();

  const { session } = data;
  const unmarked = data.participants.filter(
    (participant) => !participant.attendanceStatus
  );
  const canManage =
    session.status === SessionStatus.SCHEDULED &&
    session.startsAt > now;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SESSION OPERATIONS</p>
          <h1>
            {session.group.internalName} ·{" "}
            {formatAdminDate(session.startsAt)}
          </h1>
          <p className="admin-help">
            {session.group.sport.nameRu} ·{" "}
            {session.group.branch.publicNameRu} ·{" "}
            {[session.coach.firstName, session.coach.lastName]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-status" href="/admin/sessions">
            ← Все занятия
          </Link>
          <Link
            className="admin-status"
            href={"/admin/groups/" + session.groupId}
          >
            Открыть группу
          </Link>
        </div>
      </div>

      <section className="admin-metrics">
        <article className="admin-metric">
          <span>Состояние</span>
          <strong>{stateLabel(data.operationalState)}</strong>
        </article>
        <article className="admin-metric">
          <span>Отмечено</span>
          <strong>
            {data.marked}/{data.expected}
          </strong>
        </article>
        <article className="admin-metric">
          <span>Присутствуют</span>
          <strong>{data.present}</strong>
        </article>
        <article className="admin-metric">
          <span>Отсутствуют</span>
          <strong>{data.absent}</strong>
        </article>
        <article className="admin-metric">
          <span>Уважительные</span>
          <strong>{data.excused}</strong>
        </article>
        <article className="admin-metric">
          <span>Пробники</span>
          <strong>{data.trials}</strong>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Начало</th>
                <td>{formatAdminDate(session.startsAt)}</td>
                <th>Окончание</th>
                <td>{formatAdminDate(session.endsAt)}</td>
              </tr>
              <tr>
                <th>Статус БД</th>
                <td>{session.status}</td>
                <th>Завершено фактически</th>
                <td>{formatAdminDate(session.completedAt)}</td>
              </tr>
              <tr>
                <th>Вместимость группы</th>
                <td>{session.regularCapacity}</td>
                <th>Пробных мест</th>
                <td>{session.trialCapacity ?? "—"}</td>
              </tr>
              <tr>
                <th>Посещаемость</th>
                <td>
                  {data.attendanceRate === null
                    ? "—"
                    : data.attendanceRate + "%"}
                </td>
                <th>Не отмечено</th>
                <td>{unmarked.length}</td>
              </tr>
              {session.cancellationReason ? (
                <tr>
                  <th>Причина отмены</th>
                  <td colSpan={3}>{session.cancellationReason}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {unmarked.length > 0 ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Не отмечены</h2>
              <p className="admin-help">
                Пока эти участники не отмечены, тренер не сможет завершить
                занятие.
              </p>
            </div>
            <span className="admin-attention">{unmarked.length}</span>
          </div>
          <div className="admin-page-actions">
            {unmarked.map((participant) => (
              <Link
                className="admin-attention"
                key={participant.childId}
                href={"/admin/children/" + participant.childId}
              >
                {participant.childName}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Участники и посещаемость</h2>
            <p className="admin-help">
              Ожидаемый состав рассчитывается тем же правилом, что и экран
              тренера.
            </p>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Участник</th>
                <th>Тип</th>
                <th>Родитель</th>
                <th>Посещаемость</th>
                <th>Причина</th>
                <th>Пробное</th>
              </tr>
            </thead>
            <tbody>
              {data.participants.map((participant) => (
                <tr key={participant.childId}>
                  <td>
                    <Link
                      href={"/admin/children/" + participant.childId}
                    >
                      <strong>{participant.childName}</strong>
                    </Link>
                  </td>
                  <td>{sourceLabel(participant.source)}</td>
                  <td>
                    {participant.parentName}
                    <br />
                    <small>{participant.parentPhone}</small>
                  </td>
                  <td>{attendanceLabel(participant.attendanceStatus)}</td>
                  <td>
                    {participant.absenceReason ?? "—"}
                    {participant.absenceNote ? (
                      <>
                        <br />
                        <small>{participant.absenceNote}</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {participant.source === "TRIAL" ? (
                      <>
                        {participant.trialStatus ?? "—"}
                        <br />
                        <small>
                          {participant.assessmentCompleted
                            ? "Оценка заполнена"
                            : "Оценки нет"}
                        </small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {data.participants.length === 0 ? (
                <tr>
                  <td colSpan={6}>Участников нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section className="admin-panel admin-editor-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Перенести или отменить</h2>
              <p className="admin-help">
                Изменение конкретной Session не меняет регулярное расписание
                группы. Родители получат уведомление.
              </p>
            </div>
          </div>

          <SessionAdminControls
            session={{
              id: session.id,
              startsAt: formatSessionInput(session.startsAt),
              endsAt: formatSessionInput(session.endsAt)
            }}
          />
        </section>
      ) : null}

      {session.status === SessionStatus.COMPLETED ? (
        <section className="admin-panel admin-editor-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Повторное открытие</h2>
              <p className="admin-help">
                Только для исправления отметок. Причина обязательна и попадёт
                в Audit.
              </p>
            </div>
          </div>
          <SessionReopenControl sessionId={session.id} />
        </section>
      ) : null}

      {data.operationalState === "OVERDUE" ? (
        <section className="admin-panel">
          <p className="admin-attention">
            Тренировка закончилась, но тренер её не завершил. Нужно проверить
            отметки и завершение занятия в кабинете тренера.
          </p>
        </section>
      ) : null}
    </>
  );
}
