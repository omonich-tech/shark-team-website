"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(
          payload.error === "ADMIN_AUTH_NOT_CONFIGURED"
            ? "Admin-доступ ещё не настроен в окружении."
            : "Неверный логин или пароль."
        );
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Не удалось выполнить вход.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="admin-login-form" onSubmit={submit}>
      <label>
        <span>Логин</span>
        <input
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>

      <label>
        <span>Пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      <button className="button primary" disabled={loading}>
        {loading ? "Входим…" : "Войти"}
      </button>

      {error ? <p className="admin-login-error">{error}</p> : null}
    </form>
  );
}
