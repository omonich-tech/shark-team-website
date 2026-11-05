"use client";

import { useCallback, useEffect, useState } from "react";

type TelegramWebApp = { initData: string; ready?: () => void; expand?: () => void };
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

type Session = { id: string; startsAt: string; endsAt: string; status: string; group: string; sport: string; branch: string;
  trialBookings: { id: string; childName: string; childAge: number }[] };
type Participant = { childId: string; childName: string; parentName: string; source: string; attendanceStatus: string | null };
type CoachData = { ok: true; role: "coach"; coachName: string; sessions: Session[]; participants: Participant[] | null };
type ParentChild = { id: string; name: string; attendance: { present: number; marked: number; percent: number | null };
  enrollments: { id: string; group: string; sport: string; branch: string; status: string; periodEnd: string | null;
    nextPaymentDue: string | null; latestPayment: { status: string; amount: number } | null;
    sessions: { id: string; startsAt: string }[] }[];
  progress: { date: string; scores: Record<string, number>; comment: string | null }[];
  trials: { id: string; status: string; startsAt: string; sport: string; branch: string;
    assessment: Record<string, number> | null; feedbackRating: number | null }[] };
type ParentData = { ok: true; role: "parent"; locale: "ru" | "uz"; children: ParentChild[] };
type Dashboard = CoachData | ParentData;
type ViewRole = "parent" | "coach";
const ruDate = (date: string) => new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Tashkent", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(date));
const labels: Record<string, string> = {
  ability: "Навыки", coordination: "Координация", discipline: "Дисциплина",
  motivation: "Мотивация", physicalPreparation: "Физподготовка", psychologicalReadiness: "Психологическая готовность"
};
const statusName: Record<string, string> = {
  ACTIVE: "Активен", PAUSED: "Приостановлен", FROZEN: "Заморожен",
  PAST_DUE: "Есть задолженность", PAYMENT_DUE: "Ожидается оплата",
  CONFIRMED: "Подтверждено", ATTENDED: "Посетил", NO_SHOW: "Пропущено",
  PRESENT: "Присутствует", ABSENT: "Отсутствует", EXCUSED: "Уважительная причина"
};

export function MiniAppDashboard() {
  const [role, setRole] = useState<ViewRole>("parent");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [childId, setChildId] = useState("");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginNeeded, setLoginNeeded] = useState(false);

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
    if (new URLSearchParams(window.location.search).get("role") === "coach") setRole("coach");
  }, []);

  const load = useCallback(async (currentRole: ViewRole, sessionId?: string) => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ role: currentRole });
      if (sessionId) params.set("sessionId", sessionId);
      const res = await fetch("/api/miniapp/dashboard?" + params.toString(), {
        headers: { "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "" },
        cache: "no-store"
      });
      const body = await res.json() as Dashboard & { error?: string };
      if (!res.ok) {
        setLoginNeeded(currentRole === "coach" && body.error === "COACH_LOGIN_REQUIRED");
        setData(null);
        if (!(currentRole === "coach" && body.error === "COACH_LOGIN_REQUIRED")) setError(
          body.error === "TELEGRAM_AUTH_REQUIRED" ? "Откройте кабинет через Telegram-бота." :
          body.error === "PARENT_NOT_LINKED" ? "Профиль родителя ещё не привязан к CRM." :
          body.error === "TELEGRAM_NOT_LINKED" ? "Сначала свяжите Telegram с заявкой." : "Не удалось загрузить данные."
        );
      } else {
        setLoginNeeded(false);
        setData(body);
        if (body.role === "parent" && body.children.length) setChildId(id => id || body.children[0].id);
      }
    } catch {
      setError("Ошибка соединения с CRM. Попробуйте ещё раз.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(role, selected || undefined); }, [role, selected, load]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/coach/login", { method: "POST",
        headers: { "content-type": "application/json" }, body: JSON.stringify(login) });
      if (!response.ok) { setError("Неверный логин или пароль."); return; }
      setLogin({ username: "", password: "" });
      await load("coach", selected || undefined);
    } catch { setError("Не удалось войти."); } finally { setBusy(false); }
  }

  async function mark(child: string, status: "PRESENT" | "ABSENT" | "EXCUSED") {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/miniapp/dashboard", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: selected, childId: child, status })
      });
      if (!response.ok) { setError("Не удалось сохранить отметку. Проверьте статус тренировки."); return; }
      await load("coach", selected);
    } catch { setError("Ошибка сохранения отметки."); } finally { setBusy(false); }
  }

  const parent = data?.role === "parent" ? data : null;
  const coach = data?.role === "coach" ? data : null;
  const child = parent?.children.find(c => c.id === childId) ?? parent?.children[0];
  const selectedSession = coach?.sessions.find(s => s.id === selected);
  const allUpcoming = child?.enrollments.flatMap(e => e.sessions.map(s => ({ ...s, sport: e.sport, branch: e.branch }))) ?? [];
  allUpcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return <main className="mini-shell">
    <header className="mini-top">
      <div className="mini-brand"><span className="mini-logo">S</span><div><strong>SHARK TEAM</strong><small>Спорт начинается здесь</small></div></div>
      <div className="mini-role"><button className={role === "parent" ? "is-active" : ""} onClick={() => { setRole("parent"); setSelected(""); }}>Родитель</button><button className={role === "coach" ? "is-active" : ""} onClick={() => { setRole("coach"); setActiveTab("home"); }}>Тренер</button></div>
    </header>
    {error && <div className="mini-alert" role="alert">{error}</div>}
    {busy && <p className="mini-muted">Обновление данных…</p>}
    {loginNeeded && <form className="mini-panel mini-form" onSubmit={signIn}>
      <h2>Вход тренера</h2><p className="mini-muted">Используйте действующий логин от кабинета Shark Team.</p>
      <input autoComplete="username" placeholder="Логин" value={login.username} onChange={e => setLogin(v => ({ ...v, username: e.target.value }))} required />
      <input type="password" autoComplete="current-password" placeholder="Пароль" value={login.password} onChange={e => setLogin(v => ({ ...v, password: e.target.value }))} required />
      <button type="submit" className="mini-primary" disabled={busy}>Войти</button>
    </form>}
    {parent && <>
      <section className="mini-hero"><div className="mini-eyebrow">КАБИНЕТ РОДИТЕЛЯ</div><h1>Ваш спортивный прогресс</h1><p>Данные из CRM Shark Team</p></section>
      {parent.children.length ? <>
        <div className="mini-children">{parent.children.map(c => <button key={c.id} className={child?.id === c.id ? "is-active" : ""} onClick={() => setChildId(c.id)}>{c.name}</button>)}</div>
        {child && <div className="mini-grid">
          <article className="mini-stat"><span>Посещаемость</span><strong>{child.attendance.percent === null ? "—" : child.attendance.percent + "%"}</strong><small>{child.attendance.present} из {child.attendance.marked} отмеченных занятий за 90 дней</small></article>
          <article className="mini-stat"><span>Абонемент</span><strong className="mini-small-value">{child.enrollments[0] ? (statusName[child.enrollments[0].status] ?? child.enrollments[0].status) : "Нет"}</strong><small>{child.enrollments[0]?.nextPaymentDue ? "Следующая оплата: " + ruDate(child.enrollments[0].nextPaymentDue) : "Данные по оплате из CRM"}</small></article>
          <article className="mini-panel mini-wide"><h2>Ближайшие тренировки</h2>{allUpcoming.slice(0, 5).map(s => <div className="mini-item" key={s.id}><div><strong>{s.sport}</strong><small>{s.branch}</small></div><span>{ruDate(s.startsAt)}</span></div>)}{!allUpcoming.length && <p className="mini-muted">Предстоящих занятий пока нет.</p>}</article>
          <article className="mini-panel mini-wide"><h2>Показатели ребёнка</h2>{child.progress.length ? <>
            <p className="mini-muted">Последняя оценка: {ruDate(child.progress[0].date)}. Шкала 1–5.</p>
            {Object.entries(child.progress[0].scores).map(([key, score]) => <div className="mini-score" key={key}><div><span>{labels[key] ?? key}</span><b>{score}/5</b></div><div className="mini-track"><i style={{ width: Math.max(0, Math.min(100, score * 20)) + "%" }}/></div></div>)}
            {child.progress[0].comment && <p className="mini-muted">Комментарий тренера: {child.progress[0].comment}</p>}
          </> : <p className="mini-muted">Тренер пока не выставил оценки. Показатели появятся после первой оценки.</p>}</article>
          <article className="mini-panel mini-wide"><h2>Пробные занятия</h2>{child.trials.map(t => <div key={t.id} className="mini-item"><div><strong>{t.sport}</strong><small>{t.branch} · {statusName[t.status] ?? t.status}</small></div><span>{ruDate(t.startsAt)}</span></div>)}{!child.trials.length && <p className="mini-muted">Пробных занятий нет.</p>}</article>
        </div>}
      </> : <article className="mini-panel"><h2>Дети пока не найдены</h2><p className="mini-muted">Когда ребёнок будет связан с вашим профилем в CRM, здесь появятся его занятия и показатели.</p></article>}
    </>}
    {coach && <>
      <section className="mini-hero"><div className="mini-eyebrow">КАБИНЕТ ТРЕНЕРА</div><h1>{coach.coachName}</h1><p>Расписание и посещаемость</p></section>
      <div className="mini-grid">
        <article className="mini-stat"><span>Ближайшие занятия</span><strong>{coach.sessions.filter(s => s.status === "SCHEDULED").length}</strong><small>В доступном расписании</small></article>
        <article className="mini-stat"><span>Пробные</span><strong>{coach.sessions.reduce((sum, s) => sum + s.trialBookings.length, 0)}</strong><small>Подтверждённые записи</small></article>
        <article className="mini-panel mini-wide"><h2>Выберите тренировку</h2>{coach.sessions.map(s => <button key={s.id} className={"mini-session " + (selected === s.id ? "is-active" : "")} onClick={() => setSelected(s.id)}><span><strong>{s.sport} · {s.group}</strong><small>{s.branch} · Пробных: {s.trialBookings.length}</small></span><b>{ruDate(s.startsAt)}</b></button>)}{!coach.sessions.length && <p className="mini-muted">Тренировок пока нет.</p>}</article>
        {selectedSession && <article className="mini-panel mini-wide"><h2>Посещаемость</h2><p className="mini-muted">{selectedSession.sport} · {ruDate(selectedSession.startsAt)}</p>{coach.participants?.map(p => <div className="mini-person" key={p.childId}><div><strong>{p.childName}</strong><small>{p.source === "TRIAL" ? "Пробное" : "Ученик группы"} · {statusName[p.attendanceStatus ?? ""] ?? "Не отмечен"}</small></div><div className="mini-mark"><button title="Присутствует" aria-label={"Присутствует: " + p.childName} className={p.attendanceStatus === "PRESENT" ? "is-active" : ""} onClick={() => void mark(p.childId, "PRESENT")} disabled={busy || selectedSession.status !== "SCHEDULED"}>✓</button><button title="Отсутствует" aria-label={"Отсутствует: " + p.childName} className={p.attendanceStatus === "ABSENT" ? "is-active" : ""} onClick={() => void mark(p.childId, "ABSENT")} disabled={busy || selectedSession.status !== "SCHEDULED"}>×</button></div></div>)}{!coach.participants?.length && <p className="mini-muted">Участников пока нет.</p>}<p className="mini-muted">Завершение тренировки и подробная оценка доступны в полном кабинете CRM.</p><a className="mini-primary mini-link" href={"/coach/sessions/" + selectedSession.id}>Открыть полный журнал</a></article>}
      </div>
    </>}
    {!data && !loginNeeded && !busy && <article className="mini-panel"><h2>SHARK TEAM</h2><p className="mini-muted">Откройте приложение через Telegram. Для тренера требуется вход в CRM.</p><button className="mini-primary" onClick={() => void load(role, selected || undefined)}>Повторить</button></article>}
    <footer className="mini-footer">SHARK TEAM · Telegram Mini App · Данные CRM</footer>
  </main>;
}
