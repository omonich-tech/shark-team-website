"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Participant = {
  childId: string;
  childName: string;
  parentName: string;
  parentPhone: string;
  source: "REGULAR" | "TRIAL";
  trialBookingId: string | null;
  attendanceStatus: string | null;
  absenceReason: string | null;
  absenceNote: string | null;
  reasonSource: string | null;
  assessmentCompleted: boolean;
};

const statuses = [
  ["PRESENT", "Присутствует"],
  ["ABSENT", "Отсутствует"],
  ["EXCUSED", "Уважительная"]
] as const;

const reasons = [
  ["ILLNESS", "Болезнь"],
  ["FAMILY", "Семейные обстоятельства"],
  ["TRAVEL", "Поездка"],
  ["SCHOOL", "Учёба / школа"],
  ["OTHER", "Другое"]
] as const;

export function AttendancePanel({
  sessionId,
  initialParticipants,
  initialSessionStatus
}: {
  sessionId: string;
  initialParticipants: Participant[];
  initialSessionStatus: string;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState(initialParticipants);
  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus);
  const [savingChild, setSavingChild] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      initialParticipants.map((participant) => [
        participant.childId,
        participant.absenceReason ?? ""
      ])
    )
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      initialParticipants.map((participant) => [
        participant.childId,
        participant.absenceNote ?? ""
      ])
    )
  );
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const marked = participants.filter(
      (participant) => Boolean(participant.attendanceStatus)
    ).length;
    const present = participants.filter(
      (participant) => participant.attendanceStatus === "PRESENT"
    ).length;
    const absent = participants.filter(
      (participant) => participant.attendanceStatus === "ABSENT"
    ).length;
    const excused = participants.filter(
      (participant) => participant.attendanceStatus === "EXCUSED"
    ).length;

    return {
      marked,
      total: participants.length,
      present,
      absent,
      excused,
      complete: marked === participants.length
    };
  }, [participants]);

  const locked = sessionStatus !== "SCHEDULED";

  async function mark(childId: string, status: string) {
    if (locked) return;

    setSavingChild(childId);
    setError("");

    try {
      const response = await fetch(
        `/api/coach/sessions/${sessionId}/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            childId,
            status,
            absenceReason:
              status === "PRESENT"
                ? null
                : reasonDrafts[childId] || null,
            absenceNote:
              status === "PRESENT"
                ? null
                : noteDrafts[childId] || null
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(
          payload.error === "SESSION_LOCKED"
            ? "Тренировка уже завершена. Изменение посещаемости заблокировано."
            : "Не удалось сохранить посещаемость."
        );
        return;
      }

      setParticipants((current) =>
        current.map((participant) =>
          participant.childId === childId
            ? {
                ...participant,
                attendanceStatus: payload.attendance.status,
                absenceReason: payload.attendance.absenceReason,
                absenceNote: payload.attendance.absenceNote,
                reasonSource: payload.attendance.reasonSource
              }
            : participant
        )
      );
    } catch {
      setError("Не удалось сохранить посещаемость.");
    } finally {
      setSavingChild(null);
    }
  }

  async function completeSession() {
    if (locked || !summary.complete) return;

    setCompletionState("saving");
    setError("");

    try {
      const response = await fetch(
        `/api/coach/sessions/${sessionId}/complete`,
        {
          method: "POST"
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        if (payload.error === "ATTENDANCE_INCOMPLETE") {
          const names = Array.isArray(payload.unmarked)
            ? payload.unmarked
                .map((item: { childName?: string }) => item.childName)
                .filter(Boolean)
                .join(", ")
            : "";

          setError(
            names
              ? "Не отмечены: " + names
              : "Не все участники отмечены."
          );
        } else if (payload.error === "SESSION_NOT_STARTED") {
          setError("Нельзя завершить тренировку до её начала.");
        } else {
          setError(
            "Не удалось завершить тренировку. Обновите страницу и проверьте отметки."
          );
        }
        setCompletionState("error");
        return;
      }

      setSessionStatus("COMPLETED");
      setCompletionState("saved");
      router.refresh();
    } catch {
      setError("Не удалось завершить тренировку.");
      setCompletionState("error");
    }
  }

  return (
    <div className="attendance-list">
      <div className="coach-section-head">
        <div>
          <strong>
            Отмечено {summary.marked}/{summary.total}
          </strong>
          <small>
            Присутствуют: {summary.present} · Отсутствуют: {summary.absent} ·
            Уважительные: {summary.excused}
          </small>
        </div>
        <span>
          {sessionStatus === "COMPLETED"
            ? "COMPLETED"
            : summary.complete
              ? "Готово к завершению"
              : "Есть неотмеченные"}
        </span>
      </div>

      {participants.map((participant) => {
        const absent =
          participant.attendanceStatus === "ABSENT" ||
          participant.attendanceStatus === "EXCUSED";

        return (
          <article
            className="attendance-row attendance-row-expanded"
            key={participant.childId}
          >
            <div className="attendance-person">
              <div>
                <strong>{participant.childName}</strong>
                <span>
                  {participant.source === "TRIAL" ? "Пробное" : "Группа"}
                </span>
              </div>
              <small>
                {participant.parentName} · {participant.parentPhone}
              </small>
            </div>

            <div>
              <div className="attendance-actions">
                {statuses.map(([status, label]) => (
                  <button
                    type="button"
                    key={status}
                    className={
                      participant.attendanceStatus === status
                        ? "attendance-button active"
                        : "attendance-button"
                    }
                    disabled={
                      locked || savingChild === participant.childId
                    }
                    onClick={() => void mark(participant.childId, status)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {participant.source === "REGULAR" && absent ? (
                <div className="attendance-reason-editor">
                  <select
                    value={reasonDrafts[participant.childId] ?? ""}
                    disabled={
                      locked || savingChild === participant.childId
                    }
                    onChange={(event) =>
                      setReasonDrafts((current) => ({
                        ...current,
                        [participant.childId]: event.target.value
                      }))
                    }
                  >
                    <option value="">Причину уточнит родитель</option>
                    {reasons.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={noteDrafts[participant.childId] ?? ""}
                    disabled={
                      locked || savingChild === participant.childId
                    }
                    placeholder="Комментарий тренера, если нужен"
                    onChange={(event) =>
                      setNoteDrafts((current) => ({
                        ...current,
                        [participant.childId]: event.target.value
                      }))
                    }
                  />
                  <button
                    className="attendance-button"
                    type="button"
                    disabled={
                      locked || savingChild === participant.childId
                    }
                    onClick={() =>
                      void mark(
                        participant.childId,
                        participant.attendanceStatus ?? "ABSENT"
                      )
                    }
                  >
                    Сохранить причину
                  </button>
                </div>
              ) : null}
            </div>

            {participant.trialBookingId ? (
              <div className="attendance-assessment">
                {participant.assessmentCompleted ||
                participant.attendanceStatus === "PRESENT" ? (
                  <Link href={`/coach/trials/${participant.trialBookingId}`}>
                    {participant.assessmentCompleted
                      ? "Открыть оценку"
                      : "Оценить пробное"}
                  </Link>
                ) : (
                  <span>Оценка после отметки «Присутствует»</span>
                )}
              </div>
            ) : participant.source === "REGULAR" && absent ? (
              <div className="attendance-assessment">
                <span>
                  {participant.reasonSource === "PARENT"
                    ? "Родитель сообщил заранее"
                    : participant.absenceReason
                      ? "Причина сохранена"
                      : sessionStatus === "COMPLETED"
                        ? "Родителю отправлен запрос причины"
                        : "Запрос причины уйдёт после завершения"}
                </span>
              </div>
            ) : null}
          </article>
        );
      })}

      {participants.length === 0 ? (
        <div className="coach-empty">
          Для этого занятия пока нет учеников или пробников.
        </div>
      ) : null}

      <div className="coach-section-head">
        <div>
          <strong>
            {sessionStatus === "COMPLETED"
              ? "Тренировка завершена"
              : summary.complete
                ? "Все участники отмечены"
                : `Осталось отметить ${summary.total - summary.marked}`}
          </strong>
          <small>
            После завершения посещаемость блокируется. Повторное открытие делает
            администратор с записью в истории изменений.
          </small>
        </div>

        <button
          type="button"
          className="button primary"
          disabled={
            locked ||
            !summary.complete ||
            completionState === "saving"
          }
          onClick={() => void completeSession()}
        >
          {completionState === "saving"
            ? "Завершаем…"
            : sessionStatus === "COMPLETED"
              ? "Завершено"
              : "Завершить тренировку"}
        </button>
      </div>

      {error ? <p className="coach-form-error">{error}</p> : null}
    </div>
  );
}
