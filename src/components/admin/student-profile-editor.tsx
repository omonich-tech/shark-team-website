"use client";

import { FormEvent, useState } from "react";

export function StudentProfileEditor({
  child
}: {
  child: {
    id: string;
    name: string;
    ageAtRegistration: number;
    dateOfBirth: string;
    parentName: string;
    parentPhone: string;
    locale: string;
  };
}) {
  const [childName, setChildName] = useState(child.name);
  const [ageAtRegistration, setAge] = useState(child.ageAtRegistration);
  const [dateOfBirth, setDateOfBirth] = useState(child.dateOfBirth);
  const [parentName, setParentName] = useState(child.parentName);
  const [parentPhone, setParentPhone] = useState(child.parentPhone);
  const [locale, setLocale] = useState(child.locale);
  const [state, setState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/children/" + child.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName,
          ageAtRegistration,
          dateOfBirth,
          parentName,
          parentPhone,
          locale
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "PHONE_ALREADY_USED"
            ? "Этот телефон уже закреплён за другим родителем."
            : payload.error === "INVALID_INPUT"
              ? "Проверьте заполненные данные."
              : "Не удалось сохранить профиль."
        );
        return;
      }

      setState("saved");
      setMessage("Профиль обновлён.");
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setState("error");
      setMessage("Не удалось сохранить профиль.");
    }
  }

  return (
    <form className="admin-group-editor" onSubmit={submit}>
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>ФИО ребёнка</span>
          <input value={childName} onChange={(e) => setChildName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Возраст при регистрации</span>
          <input type="number" min={3} max={19} value={ageAtRegistration} onChange={(e) => setAge(Number(e.target.value))} />
        </label>
        <label className="admin-field">
          <span>Дата рождения</span>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>ФИО родителя</span>
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Телефон родителя</span>
          <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>Язык коммуникации</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="ru">Русский</option>
            <option value="uz">O‘zbekcha</option>
          </select>
        </label>
      </div>
      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving" ? "Сохраняем…" : "Сохранить профиль"}
        </button>
        {message ? <span className={state === "error" ? "admin-save-message error" : "admin-save-message"}>{message}</span> : null}
      </div>
    </form>
  );
}
