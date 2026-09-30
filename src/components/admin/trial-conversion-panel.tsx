"use client";

import { useState } from "react";

type ConversionView = {
  status: string | null;
  amountUzs: number | null;
  currency: string | null;
  paymentStatus: string | null;
};

export function TrialConversionPanel({
  bookingId,
  conversion,
  ready
}: {
  bookingId: string;
  conversion: ConversionView;
  ready: boolean;
}) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function act(action: string) {
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/trials/" + bookingId + "/conversion",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            adminNote: note
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        const errors: Record<string, string> = {
          TRIAL_NOT_READY:
            "Сначала нужны посещение, отзыв родителя и оценка тренера.",
          GROUP_FULL: "Группа заполнена. Абонемент предложить нельзя.",
          GROUP_NOT_OPEN: "Набор в эту группу сейчас закрыт.",
          SUBSCRIPTION_PRICE_NOT_FOUND:
            "Не настроена актуальная цена абонемента.",
          MANUAL_CARD_NOT_CONFIGURED:
            "Не настроена карта для временной оплаты.",
          ALREADY_ENROLLED: "Ребёнок уже зачислен в группу.",
          PAYMENT_UNDER_REVIEW:
            "Чек уже находится на проверке. Сначала обработайте текущую оплату.",
          OFFER_ALREADY_SENT:
            "Предложение уже отправлено родителю. Можно дождаться оплаты или отметить отказ."
        };

        setState("error");
        setMessage(errors[payload.error] ?? payload.error ?? "Ошибка.");
        return;
      }

      setState("saved");
      setMessage(
        action === "offer"
          ? payload.telegramSent === false
            ? "Предложение создано, но Telegram родителя не найден."
            : "Предложение абонемента отправлено родителю в Telegram."
          : "Статус сохранён."
      );

      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setState("error");
      setMessage("Не удалось выполнить действие.");
    }
  }

  return (
    <div className="admin-assessment">
      <div className="admin-conversion-summary">
        <div>
          <span>Статус конверсии</span>
          <strong>{conversion.status ?? (ready ? "READY" : "НЕ ГОТОВО")}</strong>
        </div>
        <div>
          <span>Абонемент</span>
          <strong>
            {conversion.amountUzs !== null
              ? new Intl.NumberFormat("ru-RU").format(
                  conversion.amountUzs
                ) + " " + (conversion.currency ?? "UZS")
              : "—"}
          </strong>
        </div>
        <div>
          <span>Оплата</span>
          <strong>{conversion.paymentStatus ?? "—"}</strong>
        </div>
      </div>

      <label className="admin-field">
        <span>Заметка администратора</span>
        <textarea
          rows={3}
          value={note}
          placeholder="Например: родитель попросил связаться вечером"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="admin-editor-actions admin-conversion-actions">
        <button
          className="button"
          type="button"
          disabled={
            !ready ||
            state === "saving" ||
            conversion.status === "ENROLLED" ||
            conversion.status === "PAYMENT_PENDING" ||
            conversion.status === "OFFERED"
          }
          onClick={() => act("thinking")}
        >
          Думает
        </button>
        <button
          className="button primary"
          type="button"
          disabled={
            !ready ||
            state === "saving" ||
            conversion.status === "ENROLLED" ||
            conversion.status === "PAYMENT_PENDING"
          }
          onClick={() => act("offer")}
        >
          Предложить абонемент
        </button>
        <button
          className="button"
          type="button"
          disabled={
            !ready ||
            state === "saving" ||
            conversion.status === "ENROLLED" ||
            conversion.status === "PAYMENT_PENDING"
          }
          onClick={() => act("decline")}
        >
          Отказался
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
