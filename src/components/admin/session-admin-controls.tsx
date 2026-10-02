"use client";

import { useState } from "react";

const errors: Record<string, string> = {
  SESSION_NOT_FOUND: "Тренировка не найдена.",
  SESSION_NOT_EDITABLE:
    "Эту тренировку уже нельзя изменять.",
  INVALID_SESSION_TIME:
    "Проверьте дату и время тренировки.",
  SESSION_TIME_CONFLICT:
    "В группе уже есть тренировка на это время.",
  SESSION_HAS_ACTIVE_TRIAL_BOOKINGS:
    "На тренировке есть активные пробные брони. Сначала обработайте их отдельно."
};

export function SessionAdminControls({
  session
}: {
  session: {
    id: string;
    startsAt: string;
    endsAt: string;
  };
}) {
  const [startsAt, setStartsAt] = useState(session.startsAt);
  const [endsAt, setEndsAt] = useState(session.endsAt);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function submit(
    payload:
      | {
          action: "reschedule";
          startsAt: string;
          endsAt: string;
        }
      | {
          action: "cancel";
          reason: string;
        }
  ) {
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/sessions/" + session.id,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setState("error");
        setMessage(
          errors[data.error] ??
            data.error ??
            "Не удалось изменить тренировку."
        );
        return;
      }

      setState("saved");
      setMessage(
        payload.action === "cancel"
          ? "Тренировка отменена. Родителям поставлены уведомления."
          : "Тренировка перенесена. Родителям поставлены уведомления."
      );

      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setState("error");
      setMessage("Не удалось изменить тренировку.");
    }
  }

  return (
    <div className="subscription-note">
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Начало</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => {
              setStartsAt(event.target.value);
              setState("idle");
            }}
          />
        </label>

        <label className="admin-field">
          <span>Окончание</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => {
              setEndsAt(event.target.value);
              setState("idle");
            }}
          />
        </label>
      </div>

      <div className="subscription-action-row">
        <button
          type="button"
          className="button primary"
          disabled={state === "saving"}
          onClick={() =>
            submit({
              action: "reschedule",
              startsAt,
              endsAt
            })
          }
        >
          🔄 Перенести
        </button>
      </div>

      <label className="admin-field">
        <span>Причина отмены</span>
        <input
          type="text"
          value={reason}
          maxLength={500}
          placeholder="Например: зал недоступен"
          onChange={(event) => {
            setReason(event.target.value);
            setState("idle");
          }}
        />
      </label>

      <div className="subscription-action-row">
        <button
          type="button"
          className="button subscription-danger"
          disabled={state === "saving"}
          onClick={() => {
            if (
              !window.confirm(
                "Отменить тренировку и уведомить родителей?"
              )
            ) {
              return;
            }

            void submit({
              action: "cancel",
              reason
            });
          }}
        >
          ❌ Отменить тренировку
        </button>

        {message ? (
          <span
            className={
              state === "error"
                ? "admin-save-message error"
                : "admin-save-message"
            }
          >
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
