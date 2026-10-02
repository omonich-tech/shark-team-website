"use client";

import { useState } from "react";

const errorMessages: Record<string, string> = {
  FREEZE_REQUEST_NOT_FOUND: "Заявка не найдена.",
  ALREADY_FROZEN: "Абонемент уже заморожен.",
  SUBSCRIPTION_NOT_FREEZABLE:
    "Абонемент больше нельзя заморозить в текущем состоянии.",
  SUBSCRIPTION_ALREADY_DUE:
    "Срок оплаты уже наступил. Сначала решите вопрос с оплатой.",
  PAYMENT_UNDER_REVIEW:
    "Чек сейчас на проверке. Заморозку пока нельзя подтвердить.",
  SUBSCRIPTION_ENDED: "Абонемент уже прекращён.",
  INVALID_FREEZE_DAYS: "Некорректный срок заморозки."
};

export function FreezeRequestReview({
  request
}: {
  request: {
    id: string;
    days: number;
    reasonLabel: string;
    createdLabel: string;
  };
}) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function review(approve: boolean) {
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/freeze-requests/" + request.id,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approve,
            decisionNote: note
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          errorMessages[payload.error] ??
            payload.error ??
            "Не удалось обработать заявку."
        );
        return;
      }

      setState("saved");
      setMessage(
        approve
          ? "Заявка одобрена. Абонемент заморожен."
          : "Заявка отклонена."
      );

      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setState("error");
      setMessage("Не удалось обработать заявку.");
    }
  }

  return (
    <div className="subscription-note">
      <strong>❄️ Заявка родителя на заморозку</strong>
      <div>
        {request.days} дней · {request.reasonLabel} ·{" "}
        {request.createdLabel}
      </div>

      <label className="admin-field">
        <span>Комментарий решения</span>
        <textarea
          rows={2}
          value={note}
          placeholder="Необязательно. При отказе этот комментарий увидит родитель."
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="subscription-action-row">
        <button
          className="button primary"
          type="button"
          disabled={state === "saving"}
          onClick={() => review(true)}
        >
          ✅ Одобрить
        </button>
        <button
          className="button subscription-danger"
          type="button"
          disabled={state === "saving"}
          onClick={() => review(false)}
        >
          ❌ Отклонить
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
