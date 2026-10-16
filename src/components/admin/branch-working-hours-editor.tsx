"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const WEEKDAYS = [
  { value: "MONDAY", ru: "Пн", uz: "Du" },
  { value: "TUESDAY", ru: "Вт", uz: "Se" },
  { value: "WEDNESDAY", ru: "Ср", uz: "Chor" },
  { value: "THURSDAY", ru: "Чт", uz: "Pay" },
  { value: "FRIDAY", ru: "Пт", uz: "Ju" },
  { value: "SATURDAY", ru: "Сб", uz: "Shan" },
  { value: "SUNDAY", ru: "Вс", uz: "Yak" }
] as const;

function parseInitialDays(value?: string | null) {
  if (!value) return [];

  const range = value.match(/(Пн|Вт|Ср|Чт|Пт|Сб|Вс)\s*[–-]\s*(Пн|Вт|Ср|Чт|Пт|Сб|Вс)/);
  if (range) {
    const startIndex = WEEKDAYS.findIndex((day) => day.ru === range[1]);
    const endIndex = WEEKDAYS.findIndex((day) => day.ru === range[2]);
    if (startIndex >= 0 && endIndex >= startIndex) {
      return WEEKDAYS.slice(startIndex, endIndex + 1).map((day) => day.value);
    }
  }

  return WEEKDAYS.filter((day) => value.includes(day.ru)).map((day) => day.value);
}

function parseInitialTime(value?: string | null) {
  const match = value?.match(/(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})/);
  return {
    start: match?.[1] ?? "09:00",
    end: match?.[2] ?? "20:00"
  };
}

export function BranchWorkingHoursEditor({
  branchId,
  initialWorkingHoursRu
}: {
  branchId: string;
  initialWorkingHoursRu?: string | null;
}) {
  const router = useRouter();
  const [days, setDays] = useState<string[]>(() => parseInitialDays(initialWorkingHoursRu));
  const [start, setStart] = useState(
    () => parseInitialTime(initialWorkingHoursRu).start
  );
  const [end, setEnd] = useState(
    () => parseInitialTime(initialWorkingHoursRu).end
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggleDay(day: string) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day]
    );
    setState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/branches/${branchId}/working-hours`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days, start, end })
        }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "WORKING_HOURS_SAVE_FAILED");
      }

      setState("saved");
      setMessage("Дни и время работы сохранены.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить время работы."
      );
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-working-days">
        {WEEKDAYS.map((day) => {
          const active = days.includes(day.value);
          return (
            <button
              className={active ? "admin-weekday active" : "admin-weekday"}
              key={day.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleDay(day.value)}
            >
              {day.ru}
            </button>
          );
        })}
      </div>

      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Начало работы</span>
          <input
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Окончание работы</span>
          <input
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>

      <div className="admin-working-hours-preview">
        <span>На сайте будет:</span>
        <strong>
          {days.length
            ? `${WEEKDAYS.filter((day) => days.includes(day.value))
                .map((day) => day.ru)
                .join(" · ")}, ${start}–${end}`
            : "Дни не выбраны"}
        </strong>
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Сохранить дни и время"}
        </button>
        {message ? (
          <span className={state === "error" ? "admin-save-message error" : "admin-save-message"}>
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
