"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const saved = window.localStorage.getItem("shark-theme");
  if (saved === "light" || saved === "dark") return saved;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const next = preferredTheme();
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("shark-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark"
          ? "Включить светлую тему"
          : "Включить тёмную тему"
      }
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    </button>
  );
}
