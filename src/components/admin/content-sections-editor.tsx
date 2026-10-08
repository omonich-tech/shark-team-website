"use client";

import { FormEvent, useState } from "react";

export type ContentSectionField = {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
};

export function ContentSectionsEditor({
  endpoint,
  title,
  description,
  fields,
  initialSections
}: {
  endpoint: string;
  title: string;
  description: string;
  fields: ContentSectionField[];
  initialSections: Record<string, string>;
}) {
  const [sections, setSections] = useState<Record<string, string>>(
    initialSections
  );
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function update(key: string, value: string) {
    setSections((current) => ({ ...current, [key]: value }));
    setState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionsJson: sections })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "CONTENT_SECTIONS_SAVE_FAILED");
      }

      setState("saved");
      setMessage("Секции сохранены.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "Не удалось сохранить."
      );
    }
  }

  return (
    <form className="admin-content-sections" onSubmit={submit}>
      <div className="admin-content-sections-head">
        <div>
          <p className="admin-panel-kicker">Секции страницы</p>
          <h3>{title}</h3>
          <small>{description}</small>
        </div>
      </div>

      <div className="admin-content-section-grid">
        {fields.map((field) => (
          <label className="admin-field" key={field.key}>
            <span>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                rows={3}
                placeholder={field.placeholder}
                value={sections[field.key] ?? ""}
                onChange={(event) => update(field.key, event.target.value)}
              />
            ) : (
              <input
                placeholder={field.placeholder}
                value={sections[field.key] ?? ""}
                onChange={(event) => update(field.key, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Сохранить секции"}
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
