"use client";

import { FormEvent, useState } from "react";

type Faq = {
  id: string;
  status: string;
  questionRu: string;
  questionUz: string;
  answerRu: string;
  answerUz: string;
  sortOrder: number;
};

const emptyFaq = {
  questionRu: "",
  questionUz: "",
  answerRu: "",
  answerUz: "",
  sortOrder: 0,
  status: "DRAFT"
};

export function FaqEditor({
  initialItems,
  branchId,
  sportId
}: {
  initialItems: Faq[];
  branchId: string;
  sportId: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState(emptyFaq);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        branchId,
        sportId
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "Не удалось добавить FAQ.");
      return;
    }

    setItems((current) => [...current, payload.faq]);
    setDraft(emptyFaq);
    setMessage("FAQ добавлен.");
  }

  function updateLocal(id: string, patch: Partial<Faq>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
  }

  async function save(item: Faq) {
    setMessage("");

    const response = await fetch(`/api/admin/faq/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        branchId,
        sportId
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "Не удалось сохранить FAQ.");
      return;
    }

    updateLocal(item.id, payload.faq);
    setMessage("FAQ сохранён.");
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить этот FAQ?")) return;

    const response = await fetch(`/api/admin/faq/${id}`, {
      method: "DELETE"
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "Не удалось удалить FAQ.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    setMessage("FAQ удалён.");
  }

  return (
    <div className="faq-editor">
      <form className="admin-faq-card" onSubmit={create}>
        <div className="admin-faq-head">
          <strong>Новый FAQ</strong>
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value
              }))
            }
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Вопрос RU</span>
            <input
              required
              value={draft.questionRu}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  questionRu: event.target.value
                }))
              }
            />
          </label>
          <label className="admin-field">
            <span>Вопрос UZ</span>
            <input
              required
              value={draft.questionUz}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  questionUz: event.target.value
                }))
              }
            />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Ответ RU</span>
            <textarea
              required
              rows={4}
              value={draft.answerRu}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  answerRu: event.target.value
                }))
              }
            />
          </label>
          <label className="admin-field admin-field-wide">
            <span>Ответ UZ</span>
            <textarea
              required
              rows={4}
              value={draft.answerUz}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  answerUz: event.target.value
                }))
              }
            />
          </label>
        </div>

        <button className="button primary">Добавить FAQ</button>
      </form>

      {items.map((item) => (
        <article className="admin-faq-card" key={item.id}>
          <div className="admin-faq-head">
            <strong>{item.id}</strong>
            <div>
              <select
                value={item.status}
                onChange={(event) =>
                  updateLocal(item.id, {
                    status: event.target.value
                  })
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
              <input
                aria-label="Порядок"
                type="number"
                value={item.sortOrder}
                onChange={(event) =>
                  updateLocal(item.id, {
                    sortOrder: Number(event.target.value)
                  })
                }
              />
            </div>
          </div>

          <div className="admin-editor-grid">
            <label className="admin-field">
              <span>Вопрос RU</span>
              <input
                value={item.questionRu}
                onChange={(event) =>
                  updateLocal(item.id, {
                    questionRu: event.target.value
                  })
                }
              />
            </label>
            <label className="admin-field">
              <span>Вопрос UZ</span>
              <input
                value={item.questionUz}
                onChange={(event) =>
                  updateLocal(item.id, {
                    questionUz: event.target.value
                  })
                }
              />
            </label>
            <label className="admin-field admin-field-wide">
              <span>Ответ RU</span>
              <textarea
                rows={4}
                value={item.answerRu}
                onChange={(event) =>
                  updateLocal(item.id, {
                    answerRu: event.target.value
                  })
                }
              />
            </label>
            <label className="admin-field admin-field-wide">
              <span>Ответ UZ</span>
              <textarea
                rows={4}
                value={item.answerUz}
                onChange={(event) =>
                  updateLocal(item.id, {
                    answerUz: event.target.value
                  })
                }
              />
            </label>
          </div>

          <div className="admin-editor-actions">
            <button
              className="button primary"
              type="button"
              onClick={() => void save(item)}
            >
              Сохранить
            </button>
            <button
              className="admin-danger-link"
              type="button"
              onClick={() => void remove(item.id)}
            >
              Удалить
            </button>
          </div>
        </article>
      ))}

      {message ? <p className="admin-save-message">{message}</p> : null}
    </div>
  );
}
