"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SportOption = {
  id: string;
  name: string;
};

export function BranchSportsEditor({
  branchId,
  sports,
  initialSportIds
}: {
  branchId: string;
  sports: SportOption[];
  initialSportIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(initialSportIds));
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
      const response = await fetch(`/api/admin/branches/${branchId}/sports`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sportIds: Array.from(selected) })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "BRANCH_SPORTS_SAVE_FAILED");
      }

      setState("saved");
      setMessage("Направления филиала сохранены.");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить направления."
      );
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-choice-grid">
        {sports.map((sport) => {
          const active = selected.has(sport.id);
          return (
            <label
              className={active ? "admin-choice-card active" : "admin-choice-card"}
              key={sport.id}
            >
              <input
                checked={active}
                type="checkbox"
                onChange={() => toggle(sport.id)}
              />
              <span>
                <strong>{sport.name}</strong>
                <small>{active ? "Показывается в филиале" : "Не показывается"}</small>
              </span>
            </label>
          );
        })}
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Сохранить направления"}
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
