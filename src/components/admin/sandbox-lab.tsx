"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Lab = {
  exists: boolean; branchId?: string; coachId?: string; groupId?: string;
  username?: string | null; enabled?: boolean;
  sessions?: { id: string; startsAt: string; status: string }[];
};
export function SandboxLab() {
  const [lab, setLab] = useState<Lab | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/admin/sandbox", { cache: "no-store" });
    if (res.ok) setLab(await res.json());
  }
  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function create() {
    setBusy(true); setError(""); setPassword("");
    try {
      const res = await fetch("/api/admin/sandbox", { method: "POST" });
      const result = await res.json();
      if (!res.ok) { setError(result.error || "Не удалось создать тестовый набор"); return; }
      setPassword(result.password);
      await refresh();
    } catch { setError("Не удалось подключиться к CRM"); }
    finally { setBusy(false); }
  }

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><p className="admin-panel-kicker">SANDBOX · НЕ ПУБЛИКУЕТСЯ</p>
        <h2>Призрачный филиал и тестовый тренер</h2>
        <small>Данные создаются в черновых объектах. Не участвуют в публичной записи и не отправляют родителям уведомления.</small>
      </div>
    </div>
    <p className="admin-page-note">Сценарий: два постоянных ученика и один ребёнок на пробном, одна тренировка для завершения сейчас и следующая завтра. Отмечайте посещаемость, оценивайте пробное и повторяйте цикл.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "18px 0" }}>
      <button className="button primary" disabled={busy} onClick={() => void create()}>
        {busy ? "Создание…" : lab?.exists ? "Сбросить тест и выдать новый пароль" : "Создать тестовый контур"}
      </button>
      {lab?.exists && <Link href="/coach" className="button secondary dark" target="_blank">Открыть кабинет тренера</Link>}
      {lab?.exists && <Link href="/miniapp?role=coach" className="button secondary dark" target="_blank">Открыть Mini App</Link>}
    </div>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {password && <div className="admin-panel" style={{ border: "2px solid #1682d8", margin: "12px 0" }}>
      <strong>Новый тестовый пароль — покажем только сейчас</strong>
      <p><code>{password}</code></p>
      <p className="admin-page-note">Скопируйте пароль. При следующем сбросе прежний пароль перестанет работать.</p>
      <button className="button secondary" onClick={() => void navigator.clipboard.writeText(password)}>Копировать пароль</button>
    </div>}
    {lab?.exists && <div className="admin-branch-summary" style={{ marginTop: 18 }}>
      <div><span>Филиал</span><strong><Link href={"/admin/branches/" + lab.branchId}>Призрачный</Link></strong></div>
      <div><span>Тренер</span><strong><Link href={"/admin/coaches/" + lab.coachId}>Тестовый</Link></strong></div>
      <div><span>Группа</span><strong><Link href={"/admin/groups/" + lab.groupId}>9–12 лет</Link></strong></div>
      <div><span>Логин</span><strong>{lab.username}</strong></div>
    </div>}
    {lab?.sessions?.length ? <div style={{ marginTop: 20 }}>
      <strong>Учебные занятия</strong>
      {lab.sessions.map(s => <p key={s.id} style={{ marginTop: 10 }}>
        <Link href={"/coach/sessions/" + s.id}>{new Date(s.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}</Link>
        {" · "}{s.status}
      </p>)}
    </div> : null}
    <p className="admin-page-note" style={{ marginTop: 22 }}>
      Важно: это учебные записи в рабочей CRM, а не отдельная база. Они скрыты от публичного каталога, но могут присутствовать во внутренних общих реестрах. Не используйте тестовые данные в финансовых отчётах.
    </p>
  </section>;
}
