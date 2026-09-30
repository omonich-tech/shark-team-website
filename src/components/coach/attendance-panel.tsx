"use client";

import Link from "next/link";
import { useState } from "react";

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
  initialParticipants
}: {
  sessionId: string;
  initialParticipants: Participant[];
}) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [savingChild, setSavingChild] = useState<string | null>(null);
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

  async function mark(childId: string, status: string) {
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
        setError("Не удалось сохранить посещаемость.");
        return;
      }

      setParticipants((current) =>
        current.map((participant) =>
          participant.childId === childId
            ? {
                ...participant,
                attendanceStatus: payload.attendance.status,
                absenceReason: payload.attendance.absenceReason,
                absenceNote: payload.attendance.absenceNote
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

  return (
    <div className="attendance-list">
      {participants.map((participant) => {
        const absent =
          participant.attendanceStatus === "ABSENT" ||
          participant.attendanceStatus === "EXCUSED";

        return (
          <article className="attendance-row attendance-row-expanded" key={participant.childId}>
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
                    disabled={savingChild === participant.childId}
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
                    disabled={savingChild === participant.childId}
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
                    disabled={savingChild === participant.childId}
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
                    disabled={savingChild === participant.childId}
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
                  {participant.absenceReason
                    ? "Причина сохранена"
                    : "Родителю отправится запрос причины"}
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

      {error ? <p className="coach-form-error">{error}</p> : null}
    </div>
  );
}
