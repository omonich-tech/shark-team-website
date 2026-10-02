"use client";

import { useState } from "react";

const errors: Record<string, string> = {
  SESSION_NOT_FOUND: "Тренировка не найдена.",
  SESSION_NOT_REOPENABLE:
    "Можно повторно открыть только завершённую тренировку.",
  REOPEN_REASON_REQUIRED:
    "Укажите причину повторного открытия."
};

export function SessionReopenControl({
  sessionId
}: {
  sessionId: string;
}) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function reopen() {
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/sessions/" + sessionId + "/reopen",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          errors[payload.error] ??
            payload.error ??
            "Не удалось открыть тренировку повторно."
        );
        return;
      }

      setState("saved");
      setMessage("Тренировка снова открыта для тренера.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setState("error");
      setMessage("Не удалось открыть тренировку повторно.");
    }
  }

  return (
    <div className="subscription-note">
      <label className="admin-field">
        <span>Причина повторного открытия</span>
        <input
          value={reason}
          maxLength={500}
          placeholder="Например: тренер ошибся в отметке"
          onChange={(event) => {
            setReason(event.target.value);
            setState("idle");
          }}
        />
      </label>

      <div className="subscription-action-row">
        <button
          className="button"
          type="button"
          disabled={state === "saving" || !reason.trim()}
          onClick={() => void reopen()}
        >
          🔓 Открыть повторно
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
