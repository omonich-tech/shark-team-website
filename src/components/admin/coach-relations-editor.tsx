"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type Option = {
  id: string;
  label: string;
  meta?: string | null;
};

function RelationGroup({
  title,
  subtitle,
  endpoint,
  payloadKey,
  options,
  initialIds
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  payloadKey: "sportIds" | "branchIds";
  options: Option[];
  initialIds: string[];
}) {
  const router = useRouter();
  const initial = useMemo(() => new Set(initialIds), [initialIds]);
  const [selected, setSelected] = useState(() => new Set(initialIds));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setState("idle");
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [payloadKey]: Array.from(selected) })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "RELATION_SAVE_FAILED");
      }

      setState("saved");
      setMessage("Сохранено.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить."
      );
    }
  }

  const changed =
    selected.size !== initial.size ||
    Array.from(selected).some((id) => !initial.has(id));

  return (
    <form className="coach-relation-group" onSubmit={save}>
      <div className="coach-relation-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{selected.size} выбрано</span>
      </div>

      <div className="admin-choice-grid">
        {options.map((option) => {
          const active = selected.has(option.id);
          return (
            <label
              className={active ? "admin-choice-card active" : "admin-choice-card"}
              key={option.id}
            >
              <input
                checked={active}
                type="checkbox"
                onChange={() => toggle(option.id)}
              />
              <span>
                <strong>{option.label}</strong>
                <small>
                  {option.meta || (active ? "Назначено" : "Не назначено")}
                </small>
              </span>
            </label>
          );
        })}

        {options.length === 0 ? (
          <div className="dashboard-empty">Нет доступных вариантов.</div>
        ) : null}
      </div>

      <div className="admin-editor-actions">
        <button
          className="button primary"
          disabled={state === "saving" || !changed}
        >
          {state === "saving" ? "Сохраняем…" : "Сохранить"}
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

export function CoachRelationsEditor({
  coachId,
  sports,
  branches,
  initialSportIds,
  initialBranchIds
}: {
  coachId: string;
  sports: Option[];
  branches: Option[];
  initialSportIds: string[];
  initialBranchIds: string[];
}) {
  return (
    <div className="coach-relations-editor">
      <RelationGroup
        title="Виды спорта"
        subtitle="Определяет направления тренера на сайте и в операционной модели."
        endpoint={`/api/admin/coaches/${coachId}/sports`}
        payloadKey="sportIds"
        options={sports}
        initialIds={initialSportIds}
      />

      <RelationGroup
        title="Филиалы"
        subtitle="Где тренер может вести группы и отображаться публично."
        endpoint={`/api/admin/coaches/${coachId}/branches`}
        payloadKey="branchIds"
        options={branches}
        initialIds={initialBranchIds}
      />
    </div>
  );
}
