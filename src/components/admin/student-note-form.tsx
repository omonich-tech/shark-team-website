"use client";

import { FormEvent, useState } from "react";

export function StudentNoteForm({ childId }: { childId: string }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle"|"saving"|"error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/children/" + childId + "/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage("Не удалось добавить заметку.");
        return;
      }
      setNote("");
      window.location.reload();
    } catch {
      setState("error");
      setMessage("Не удалось добавить заметку.");
    }
  }

  return (
    <form className="admin-group-editor" onSubmit={submit}>
      <label className="admin-field">
        <span>Внутренняя заметка — видна только администраторам</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={note}
          placeholder="Например: родитель просил связаться после 18:00; обсуждали перевод в другую группу."
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving" || !note.trim()}>
          {state === "saving" ? "Добавляем…" : "Добавить заметку"}
        </button>
        {message ? <span className="admin-save-message error">{message}</span> : null}
      </div>
    </form>
  );
}
