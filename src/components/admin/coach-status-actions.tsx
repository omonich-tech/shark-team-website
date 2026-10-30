"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CoachStatusActions({
  coachId, coachName, status
}: { coachId: string; coachName: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function changeStatus(nextStatus: "ACTIVE" | "ARCHIVED") {
    if (nextStatus === "ARCHIVED" && !window.confirm(
      `Убрать тренера «${coachName}» из действующей команды? Профиль будет архивирован, доступ в кабинет отключён. История останется в CRM.`
    )) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/coaches/${coachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SET_STATUS", status: nextStatus })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        if (response.status === 401) {
          setError("Сессия администратора истекла. Войдите снова в CRM — профиль и кабинет тренера сохранены.");
        } else if (payload.error === "COACH_HAS_GROUP_DEPENDENCIES") {
          const groups = payload.dependencies?.groups ?? [];
          setError(`Нельзя удалить тренера: сначала переназначьте или архивируйте связанные группы (${groups.map((item: {internalName: string}) => item.internalName).join(", ")}).`);
        } else if (payload.error === "COACH_HAS_ACTIVE_GROUPS") {
          setError("Нельзя отключить тренера, пока есть активные группы.");
        } else {
          setError(payload.error ?? "Не удалось изменить статус тренера.");
        }
        return;
      }
      if (nextStatus === "ARCHIVED") {
        router.push("/admin/coaches");
      } else {
        router.refresh();
      }
    } catch {
      setError("Нет соединения с сервером. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-editor-actions">
      {status !== "ACTIVE" && status !== "ARCHIVED" ? (
        <button className="button primary" type="button" disabled={busy} onClick={() => void changeStatus("ACTIVE")}>
          {busy ? "Сохраняем…" : "Активировать тренера"}
        </button>
      ) : null}
      {status !== "ARCHIVED" ? (
        <button className="button secondary dark" type="button" disabled={busy} onClick={() => void changeStatus("ARCHIVED")}>
          Удалить тренера
        </button>
      ) : null}
      {error ? <p role="alert" className="admin-save-message error">{error}</p> : null}
    </div>
  );
}
