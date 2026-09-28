"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CoachAccessForm({
  coachId,
  account
}: {
  coachId: string;
  account: {
    username: string;
    isActive: boolean;
  } | null;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(account?.username ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [state, setState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/coaches/${coachId}/account`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username,
            password,
            isActive
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(
          payload.error === "COACH_PASSWORD_TOO_SHORT"
            ? "Пароль должен быть не короче 12 символов."
            : payload.error === "COACH_PASSWORD_REQUIRED"
              ? "Для новой учётки задайте пароль."
              : payload.error === "COACH_USERNAME_EXISTS"
                ? "Этот логин уже занят."
                : payload.error === "INVALID_USERNAME"
                  ? "Логин: 3–64 символа, латиница, цифры, . _ -"
                  : "Не удалось сохранить доступ."
        );
        return;
      }

      setPassword("");
      setState("saved");
      setMessage("Доступ тренера сохранён.");
      router.refresh();
    } catch {
      setState("error");
      setMessage("Не удалось сохранить доступ.");
    }
  }

  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Логин</span>
          <input
            required
            autoComplete="username"
            minLength={3}
            maxLength={64}
            placeholder="dilshod"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>
            {account ? "Новый пароль (необязательно)" : "Пароль"}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            required={!account}
            minLength={12}
            placeholder={
              account
                ? "Оставьте пустым, чтобы не менять"
                : "Минимум 12 символов"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span>Состояние учётки</span>
          <select
            value={isActive ? "active" : "disabled"}
            onChange={(event) =>
              setIsActive(event.target.value === "active")
            }
          >
            <option value="active">Активна</option>
            <option value="disabled">Отключена</option>
          </select>
        </label>
      </div>

      <p className="admin-help">
        Пароль не хранится в открытом виде. При смене создаются новый
        случайный salt и scrypt-hash. Пустое поле пароля не меняет
        существующий пароль.
      </p>

      <div className="admin-editor-actions">
        <button className="button primary" disabled={state === "saving"}>
          {state === "saving"
            ? "Сохраняем…"
            : account
              ? "Обновить доступ"
              : "Создать доступ"}
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
