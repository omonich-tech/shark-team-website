"use client";

type Theme = "light" | "dark";

export function ThemeToggle() {
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
