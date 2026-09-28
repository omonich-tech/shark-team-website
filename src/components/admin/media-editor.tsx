"use client";

import { FormEvent, useState } from "react";

type TargetOption = {
  value: string;
  label: string;
  type: string;
};

type MediaItem = {
  id: string;
  targetType: string;
  targetId: string;
  category: string;
  url: string;
  contentType: string | null;
  size: number | null;
  isPrimary: boolean;
  altRu: string | null;
  altUz: string | null;
  containsMinors: boolean;
  consentStatus: string;
  sortOrder: number;
};

const categories = [
  "MAIN",
  "FACADE",
  "ENTRANCE",
  "HALL",
  "TRAINING",
  "EQUIPMENT",
  "COACH_PROFILE",
  "OTHER"
];

export function MediaEditor({
  targets,
  initialItems
}: {
  targets: TargetOption[];
  initialItems: MediaItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [targetKey, setTargetKey] = useState(
    targets[0] ? `${targets[0].type}:${targets[0].value}` : ""
  );
  const [category, setCategory] = useState("MAIN");
  const [containsMinors, setContainsMinors] = useState(false);
  const [consentStatus, setConsentStatus] = useState("NOT_REQUIRED");
  const [isPrimary, setIsPrimary] = useState(true);
  const [altRu, setAltRu] = useState("");
  const [altUz, setAltUz] = useState("");
  const [state, setState] = useState<
    "idle" | "uploading" | "error" | "saved"
  >("idle");
  const [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file");

    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      return;
    }

    const [targetType, targetId] = targetKey.split(":");
    const data = new FormData();
    data.set("file", fileInput.files[0]);
    data.set("targetType", targetType);
    data.set("targetId", targetId);
    data.set("category", category);
    data.set("containsMinors", String(containsMinors));
    data.set(
      "consentStatus",
      containsMinors ? consentStatus : "NOT_REQUIRED"
    );
    data.set("isPrimary", String(isPrimary));
    data.set("altRu", altRu);
    data.set("altUz", altUz);

    setState("uploading");
    setMessage("");

    try {
      const response = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: data
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(payload.error ?? "Не удалось загрузить файл.");
        return;
      }

      setItems((current) => [payload.asset, ...current]);
      setState("saved");
      setMessage("Файл загружен.");
      form.reset();
      setAltRu("");
      setAltUz("");
    } catch {
      setState("error");
      setMessage("Не удалось загрузить файл.");
    }
  }

  async function update(
    item: MediaItem,
    patch: Partial<MediaItem>
  ) {
    const response = await fetch(`/api/admin/media/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...item, ...patch })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "Не удалось обновить медиа.");
      setState("error");
      return;
    }

    setItems((current) =>
      current.map((existing) =>
        existing.id === item.id ? payload.asset : existing
      )
    );
    setState("saved");
    setMessage("Медиа обновлено.");
  }

  async function remove(item: MediaItem) {
    if (!window.confirm("Удалить этот файл из медиатеки?")) return;

    const response = await fetch(`/api/admin/media/${item.id}`, {
      method: "DELETE"
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setState("error");
      setMessage(payload.error ?? "Не удалось удалить файл.");
      return;
    }

    setItems((current) =>
      current.filter((existing) => existing.id !== item.id)
    );
    setState("saved");
    setMessage("Файл удалён.");
  }

  return (
    <div className="media-editor">
      <form className="admin-panel admin-editor-panel" onSubmit={upload}>
        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Объект</span>
            <select
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
            >
              {targets.map((target) => (
                <option
                  value={`${target.type}:${target.value}`}
                  key={`${target.type}:${target.value}`}
                >
                  {target.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Категория</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Файл</span>
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
            />
          </label>

          <label className="admin-field">
            <span>Главное фото/видео</span>
            <select
              value={String(isPrimary)}
              onChange={(event) =>
                setIsPrimary(event.target.value === "true")
              }
            >
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
          </label>

          <label className="admin-field">
            <span>Есть несовершеннолетние</span>
            <select
              value={String(containsMinors)}
              onChange={(event) => {
                const value = event.target.value === "true";
                setContainsMinors(value);
                setConsentStatus(value ? "PENDING" : "NOT_REQUIRED");
              }}
            >
              <option value="false">Нет</option>
              <option value="true">Да</option>
            </select>
          </label>

          {containsMinors ? (
            <label className="admin-field">
              <span>Согласие на публикацию</span>
              <select
                value={consentStatus}
                onChange={(event) =>
                  setConsentStatus(event.target.value)
                }
              >
                <option value="PENDING">Ожидается</option>
                <option value="APPROVED">Подтверждено</option>
                <option value="REJECTED">Запрещено</option>
              </select>
            </label>
          ) : null}

          <label className="admin-field">
            <span>Alt RU</span>
            <input
              value={altRu}
              onChange={(event) => setAltRu(event.target.value)}
            />
          </label>

          <label className="admin-field">
            <span>Alt UZ</span>
            <input
              value={altUz}
              onChange={(event) => setAltUz(event.target.value)}
            />
          </label>
        </div>

        <div className="admin-editor-actions">
          <button
            className="button primary"
            disabled={state === "uploading" || !targetKey}
          >
            {state === "uploading" ? "Загружаем…" : "Загрузить"}
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

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Медиатека</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Объект</th>
                <th>Категория</th>
                <th>Файл</th>
                <th>Дети</th>
                <th>Согласие</th>
                <th>Главный</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.targetType}
                    <br />
                    {item.targetId}
                  </td>
                  <td>
                    <select
                      value={item.category}
                      onChange={(event) =>
                        void update(item, {
                          category: event.target.value
                        })
                      }
                    >
                      {categories.map((value) => (
                        <option value={value} key={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.contentType ?? "media"}
                    </a>
                    <br />
                    <small>
                      {item.size
                        ? `${Math.round(item.size / 1024)} KB`
                        : "—"}
                    </small>
                  </td>
                  <td>{item.containsMinors ? "Да" : "Нет"}</td>
                  <td>
                    {item.containsMinors ? (
                      <select
                        value={item.consentStatus}
                        onChange={(event) =>
                          void update(item, {
                            consentStatus: event.target.value
                          })
                        }
                      >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    ) : (
                      "Not required"
                    )}
                  </td>
                  <td>
                    <button
                      className="admin-inline-button"
                      type="button"
                      onClick={() =>
                        void update(item, {
                          isPrimary: !item.isPrimary
                        })
                      }
                    >
                      {item.isPrimary ? "Да" : "Нет"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="admin-danger-link"
                      type="button"
                      onClick={() => void remove(item)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    Медиа пока нет. Можно загрузить позже.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
