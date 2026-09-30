"use client";

import { useState } from "react";

type SubscriptionView = {
  status: string;
  enrollmentStatus: string;
  paymentUnderReview: boolean;
};

const errorMessages: Record<string, string> = {
  INVALID_FREEZE_DAYS: "Доступна заморозка только на 7, 14 или 30 дней.",
  ALREADY_FROZEN: "Абонемент уже заморожен.",
  SUBSCRIPTION_NOT_FREEZABLE:
    "Этот абонемент сейчас нельзя заморозить.",
  SUBSCRIPTION_ALREADY_DUE:
    "Срок оплаты уже наступил. Сначала нужно решить вопрос с оплатой.",
  PAYMENT_UNDER_REVIEW:
    "Чек находится на проверке. Сначала обработайте текущую оплату.",
  SUBSCRIPTION_NOT_FROZEN:
    "Абонемент сейчас не находится в ручной заморозке.",
  SUBSCRIPTION_ENDED: "Абонемент уже прекращён.",
  ENROLLMENT_NOT_FOUND: "Абонемент не найден."
};

export function SubscriptionControls({
  enrollmentId,
  subscription
}: {
  enrollmentId: string;
  subscription: SubscriptionView;
}) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function act(action: "freeze" | "resume" | "end", days?: number) {
    if (
      action === "end" &&
      !window.confirm(
        "Прекратить абонемент окончательно? Ребёнок будет удалён из активного состава группы."
      )
    ) {
      return;
    }

    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/enrollments/" + enrollmentId + "/subscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            days,
            reason
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          errorMessages[payload.error] ?? payload.error ?? "Ошибка."
        );
        return;
      }

      setState("saved");
      setMessage(
        action === "freeze"
          ? "Заморозка оформлена. Оплаченный срок перенесён."
          : action === "resume"
            ? "Абонемент возобновлён."
            : "Абонемент прекращён."
      );

      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setState("error");
      setMessage("Не удалось выполнить действие.");
    }
  }

  const frozen = subscription.status === "FROZEN";
  const ended =
    subscription.status === "ENDED" ||
    subscription.enrollmentStatus === "ENDED";
  const freezeAllowed =
    !ended &&
    !frozen &&
    !subscription.paymentUnderReview &&
    (subscription.status === "ACTIVE" ||
      subscription.status === "PAYMENT_DUE");

  return (
    <div className="subscription-controls">
      {!ended ? (
        <label className="admin-field">
          <span>Причина / комментарий</span>
          <textarea
            rows={2}
            value={reason}
            placeholder="Например: поездка семьи, болезнь, просьба родителя"
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : null}

      <div className="subscription-action-row">
        {freezeAllowed ? (
          <>
            <button
              className="button"
              type="button"
              disabled={state === "saving"}
              onClick={() => act("freeze", 7)}
            >
              Заморозить 7 дней
            </button>
            <button
              className="button"
              type="button"
              disabled={state === "saving"}
              onClick={() => act("freeze", 14)}
            >
              14 дней
            </button>
            <button
              className="button"
              type="button"
              disabled={state === "saving"}
              onClick={() => act("freeze", 30)}
            >
              30 дней
            </button>
          </>
        ) : null}

        {frozen ? (
          <button
            className="button primary"
            type="button"
            disabled={state === "saving"}
            onClick={() => act("resume")}
          >
            Возобновить сейчас
          </button>
        ) : null}

        {!ended ? (
          <button
            className="button subscription-danger"
            type="button"
            disabled={
              state === "saving" || subscription.paymentUnderReview
            }
            onClick={() => act("end")}
          >
            Прекратить абонемент
          </button>
        ) : null}

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
