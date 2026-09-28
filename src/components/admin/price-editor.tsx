"use client";

import { FormEvent, useState } from "react";

export function PriceEditor({
  branchId,
  sportId,
  trialAmount,
  subscriptionAmount
}: {
  branchId: string;
  sportId: string;
  trialAmount: number | null;
  subscriptionAmount: number | null;
}) {
  const [trial, setTrial] = useState<number | "">(trialAmount ?? "");
  const [subscription, setSubscription] = useState<number | "">(
    subscriptionAmount ?? ""
  );
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function savePrice(productType: string, amount: number) {
    const response = await fetch("/api/admin/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType,
        amount,
        branchId,
        sportId
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "PRICE_SAVE_FAILED");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trial === "" || subscription === "") {
      setState("error");
      setMessage("Заполните обе цены.");
      return;
    }

    setState("saving");
    setMessage("");

    try {
      if (trialAmount !== trial) {
        await savePrice("TRIAL", trial);
      }

      if (subscriptionAmount !== subscription) {
        await savePrice("SUBSCRIPTION", subscription);
      }

      setState("saved");
      setMessage(
        "Новые цены созданы с текущей даты. История старых цен сохранена."
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить цены."
      );
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Пробное занятие, UZS</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={trial}
            onChange={(event) =>
              setTrial(
                event.target.value === ""
                  ? ""
                  : Number(event.target.value)
              )
            }
          />
        </label>

        <label className="admin-field">
          <span>Абонемент / месяц, UZS</span>
          <input
            type="number"
            min={0}
            step={1000}
            value={subscription}
            onChange={(event) =>
              setSubscription(
                event.target.value === ""
                  ? ""
                  : Number(event.target.value)
              )
            }
          />
        </label>
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Изменить цены"}
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
    </form>
  );
}
