"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BranchDangerZone({
  branchId,
  branchName
}: {
  branchId: string;
  branchName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");
  const [message, setMessage] = useState("");

  async function removeBranch() {
    const confirmed = window.confirm(
      `Удалить филиал «${branchName}» навсегда? Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    setState("deleting");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/branches/${branchId}`, {
        method: "DELETE"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        if (payload.error === "BRANCH_HAS_HISTORY") {
          const counts = payload.dependencies ?? {};
          const parts = [
            counts.groups ? `группы: ${counts.groups}` : "",
            counts.prices ? `цены: ${counts.prices}` : "",
            counts.leads ? `лиды: ${counts.leads}` : ""
          ].filter(Boolean);

          throw new Error(
            `Филиал нельзя удалить навсегда: есть связанные данные (${parts.join(", ")}). Переведите его в статус ARCHIVED.`
          );
        }

        throw new Error(payload.error ?? "BRANCH_DELETE_FAILED");
      }

      router.push("/admin/branches");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось удалить филиал."
      );
    }
  }

  return (
    <section className="admin-panel admin-danger-zone">
      <div>
        <p className="admin-panel-kicker">Опасная зона</p>
        <h2>Удаление филиала</h2>
        <small>
          Полное удаление доступно только для филиала без групп, цен и лидов.
          Если история уже есть, используйте статус ARCHIVED.
        </small>
      </div>

      <div className="admin-danger-zone-actions">
        <button
          className="admin-delete-button"
          type="button"
          disabled={state === "deleting"}
          onClick={removeBranch}
        >
          {state === "deleting" ? "Удаляем…" : "Удалить филиал навсегда"}
        </button>
        {message ? <span className="admin-save-message error">{message}</span> : null}
      </div>
    </section>
  );
}
