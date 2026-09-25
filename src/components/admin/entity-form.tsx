"use client";

import { FormEvent, useState } from "react";

type FieldOption = {
  value: string;
  label: string;
};

export type AdminField = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select";
  options?: FieldOption[];
  required?: boolean;
  placeholder?: string;
};

type FormValue = string | number | null;

export function AdminEntityForm({
  endpoint,
  method = "PATCH",
  fields,
  initialValues,
  submitLabel = "Сохранить",
  onSaved
}: {
  endpoint: string;
  method?: "PATCH" | "POST";
  fields: AdminField[];
  initialValues: Record<string, FormValue>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  function update(name: string, value: FormValue) {
    setValues((current) => ({
      ...current,
      [name]: value
    }));
    setState("idle");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(payload.error ?? "Не удалось сохранить изменения.");
        return;
      }

      setState("saved");
      setMessage("Сохранено.");
      onSaved?.();
    } catch {
      setState("error");
      setMessage("Не удалось сохранить изменения.");
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-grid">
        {fields.map((field) => {
          const value = values[field.name] ?? "";

          return (
            <label
              className={
                field.type === "textarea"
                  ? "admin-field admin-field-wide"
                  : "admin-field"
              }
              key={field.name}
            >
              <span>{field.label}</span>

              {field.type === "textarea" ? (
                <textarea
                  rows={5}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={String(value)}
                  onChange={(event) =>
                    update(field.name, event.target.value)
                  }
                />
              ) : field.type === "select" ? (
                <select
                  required={field.required}
                  value={String(value)}
                  onChange={(event) =>
                    update(field.name, event.target.value)
                  }
                >
                  {field.options?.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={value === null ? "" : String(value)}
                  onChange={(event) =>
                    update(
                      field.name,
                      field.type === "number"
                        ? event.target.value === ""
                          ? null
                          : Number(event.target.value)
                        : event.target.value
                    )
                  }
                />
              )}
            </label>
          );
        })}
      </div>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : submitLabel}
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
