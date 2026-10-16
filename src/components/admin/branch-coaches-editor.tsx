"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CoachOption = {
  id: string;
  name: string;
  meta?: string | null;
};

export function BranchCoachesEditor({
  branchId,
  coaches,
  initialCoachIds
}: {
  branchId: string;
  coaches: CoachOption[];
  initialCoachIds: string[];
}) {
  const router = useRouter();
  const initial = useMemo(() => new Set(initialCoachIds), [initialCoachIds]);
  const [selected, setSelected] = useState(() => new Set(initialCoachIds));
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/branches/${branchId}/coaches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachIds: Array.from(selected) })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "BRANCH_COACHES_SAVE_FAILED");
      }

      setState("saved");
      setMessage("Тренеры филиала сохранены.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить тренеров."
      );
    }
  }

  const changed =
    selected.size !== initial.size ||
    Array.from(selected).some((id) => !initial.has(id));

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-choice-grid">
        {coaches.map((coach) => {
          const active = selected.has(coach.id);

          return (
            <label
              className={active ? "admin-choice-card active" : "admin-choice-card"}
              key={coach.id}
            >
              <input
                checked={active}
                type="checkbox"
                onChange={() => toggle(coach.id)}
              />
              <span>
                <strong>{coach.name}</strong>
                <small>
                  {coach.meta || (active ? "Назначен в филиал" : "Не назначен")}
                </small>
              </span>
            </label>
          );
        })}

        {coaches.length === 0 ? (
          <div className="dashboard-empty">Тренеров пока нет.</div>
        ) : null}
      </div>

      <div className="admin-editor-actions">
        <button
          className="button primary"
          disabled={state === "saving" || !changed}
        >
          {state === "saving" ? "Сохраняем…" : "Сохранить тренеров"}
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
