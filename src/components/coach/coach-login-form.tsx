"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function CoachLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/coach/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(
          payload.error === "COACH_AUTH_NOT_CONFIGURED"
            ? "Доступ тренера ещё не настроен."
            : "Неверный логин или пароль."
        );
        return;
      }

      router.replace("/coach");
      router.refresh();
    } catch {
      setError("Не удалось выполнить вход.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="coach-login-form" onSubmit={submit}>
      <label>
        <span>Логин</span>
        <input
          required
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>

      <label>
        <span>Пароль</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <button className="button primary" disabled={loading}>
        {loading ? "Входим…" : "Войти"}
      </button>

      {error ? <p className="coach-form-error">{error}</p> : null}
    </form>
  );
}
