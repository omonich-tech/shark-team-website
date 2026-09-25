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
  assessmentCompleted: boolean;
};

const statuses = [
  ["PRESENT", "Присутствует"],
  ["ABSENT", "Отсутствует"],
  ["EXCUSED", "Уважительная"]
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
            status
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
                attendanceStatus: payload.attendance.status
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
      {participants.map((participant) => (
        <article className="attendance-row" key={participant.childId}>
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

          {participant.trialBookingId ? (
            <div className="attendance-assessment">
              {participant.assessmentCompleted ||
              participant.attendanceStatus === "PRESENT" ? (
                <Link
                  href={`/coach/trials/${participant.trialBookingId}`}
                >
                  {participant.assessmentCompleted
                    ? "Открыть оценку"
                    : "Оценить пробное"}
                </Link>
              ) : (
                <span>Оценка после отметки «Присутствует»</span>
              )}
            </div>
          ) : null}
        </article>
      ))}

      {participants.length === 0 ? (
        <div className="coach-empty">
          Для этого занятия пока нет учеников или пробников.
        </div>
      ) : null}

      {error ? <p className="coach-form-error">{error}</p> : null}
    </div>
  );
}
