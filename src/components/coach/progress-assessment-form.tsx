"use client";

import { useState } from "react";

const criteria = [
  ["ability", "Навыки"],
  ["discipline", "Дисциплина"],
  ["motivation", "Мотивация"],
  ["coordination", "Координация"],
  ["physicalPreparation", "Физподготовка"],
  ["psychologicalReadiness", "Психологическая готовность"]
] as const;

export function ProgressAssessmentForm({ childId }: { childId: string }) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(criteria.map(([key]) => [key, 3]))
  );
  const [comment, setComment] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/coach/students/" + childId + "/progress",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...scores,
            coachComment: comment,
            recommendation
          })
        }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "STUDENT_NOT_AVAILABLE"
            ? "Ученик сейчас недоступен для оценки."
            : "Не удалось сохранить оценку."
        );
        return;
      }

      setState("saved");
      setMessage("Оценка сохранена. Родителю будет отправлен отчёт.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setState("error");
      setMessage("Не удалось сохранить оценку.");
    }
  }

  return (
    <form className="progress-form" onSubmit={submit}>
      <div className="progress-score-grid">
        {criteria.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <select
              value={scores[key]}
              disabled={state === "saving"}
              onChange={(event) =>
                setScores((current) => ({
                  ...current,
                  [key]: Number(event.target.value)
                }))
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label>
        <span>Комментарий тренера</span>
        <textarea
          rows={3}
          value={comment}
          disabled={state === "saving"}
          placeholder="Что изменилось, что получается лучше"
          onChange={(event) => setComment(event.target.value)}
        />
      </label>

      <label>
        <span>Рекомендация</span>
        <textarea
          rows={3}
          value={recommendation}
          disabled={state === "saving"}
          placeholder="На чём сосредоточиться до следующей оценки"
          onChange={(event) => setRecommendation(event.target.value)}
        />
      </label>

      <div>
        <button className="button primary" type="submit" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняю…" : "Сохранить оценку"}
        </button>
        {message ? (
          <p className={state === "error" ? "coach-form-error" : "coach-form-success"}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
