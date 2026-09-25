"use client";

import { FormEvent, useState } from "react";

type Scores = {
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
};

const criteria = [
  ["ability", "Способности"],
  ["discipline", "Дисциплина"],
  ["motivation", "Мотивация"],
  ["coordination", "Координация"],
  ["physicalPreparation", "Физическая подготовка"],
  ["psychologicalReadiness", "Психологическая готовность"]
] as const;

export function TrialAssessmentForm({
  bookingId,
  initialScores,
  initialComment,
  initialRecommendation
}: {
  bookingId: string;
  initialScores?: Scores | null;
  initialComment?: string | null;
  initialRecommendation?: string | null;
}) {
  const [scores, setScores] = useState<Scores>(
    initialScores ?? {
      ability: 3,
      discipline: 3,
      motivation: 3,
      coordination: 3,
      physicalPreparation: 3,
      psychologicalReadiness: 3
    }
  );
  const [coachComment, setCoachComment] = useState(initialComment ?? "");
  const [recommendation, setRecommendation] = useState(
    initialRecommendation ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<"saved" | "error" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setState(null);

    try {
      const response = await fetch(
        `/api/coach/trials/${bookingId}/assessment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...scores,
            coachComment,
            recommendation
          })
        }
      );

      const payload = await response.json();

      setState(response.ok && payload.ok ? "saved" : "error");
    } catch {
      setState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="assessment-form" onSubmit={submit}>
      <div className="assessment-grid">
        {criteria.map(([key, label]) => (
          <label className="assessment-criterion" key={key}>
            <span>{label}</span>
            <select
              value={scores[key]}
              onChange={(event) =>
                setScores((current) => ({
                  ...current,
                  [key]: Number(event.target.value)
                }))
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label className="assessment-text">
        <span>Комментарий тренера</span>
        <textarea
          rows={5}
          maxLength={1000}
          value={coachComment}
          onChange={(event) => setCoachComment(event.target.value)}
        />
      </label>

      <label className="assessment-text">
        <span>Рекомендация</span>
        <textarea
          rows={3}
          maxLength={500}
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value)}
        />
      </label>

      <button className="button primary" disabled={saving}>
        {saving ? "Сохраняем…" : "Сохранить оценку"}
      </button>

      {state === "saved" ? (
        <p className="coach-form-success">Оценка сохранена.</p>
      ) : null}
      {state === "error" ? (
        <p className="coach-form-error">Не удалось сохранить оценку.</p>
      ) : null}
    </form>
  );
}
