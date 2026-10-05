"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    document.documentElement.dataset.theme = preferredTheme();
  }, []);

  function toggle() {
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next: Theme = current === "dark" ? "light" : "dark";

    window.localStorage.setItem("shark-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label="Переключить светлую или тёмную тему"
      title="Light / Dark"
    >
      <span aria-hidden="true">◐</span>
    </button>
  );
}
