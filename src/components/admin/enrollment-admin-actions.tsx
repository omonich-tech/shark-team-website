"use client";

import { FormEvent, useState } from "react";

const errors: Record<string,string> = {
  TARGET_GROUP_REQUIRED: "Выберите группу.",
  TARGET_GROUP_UNAVAILABLE: "Целевая группа недоступна.",
  TARGET_GROUP_CLOSED: "Набор в целевую группу закрыт.",
  TARGET_GROUP_FULL: "В целевой группе нет свободных мест.",
  ALREADY_IN_TARGET_GROUP: "Ученик уже состоит в этой группе.",
  SAME_GROUP: "Это текущая группа ученика.",
  PAYMENT_UNDER_REVIEW: "Сначала завершите проверку текущей оплаты.",
  TARGET_PRICE_MISSING: "Для новой группы не настроена цена абонемента.",
  BILLING_HISTORY_MISSING: "Нет связанной истории оплаты для этого абонемента.",
  AMOUNT_REQUIRED: "Укажите сумму оплаты.",
  ENROLLMENT_ENDED: "Этот абонемент уже завершён."
};

export function EnrollmentAdminActions({
  enrollmentId,
  currentGroupId,
  ended,
  groups,
  suggestedAmount
}: {
  enrollmentId: string;
  currentGroupId: string;
  ended: boolean;
  groups: Array<{id:string; name:string; branch:string; sport:string; free:number}>;
  suggestedAmount: number | null;
}) {
  const [targetGroupId, setTargetGroupId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [amountUzs, setAmountUzs] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [paidAt, setPaidAt] = useState("");
  const [state, setState] = useState<"idle"|"saving"|"error">("idle");
  const [message, setMessage] = useState("");

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetGroupId) return;
    if (!window.confirm("Перевести ученика в выбранную группу?")) return;
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/enrollments/" + enrollmentId + "/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetGroupId, reason: transferReason })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(errors[payload.error] ?? "Не удалось перевести ученика.");
        return;
      }
      window.location.reload();
    } catch {
      setState("error");
      setMessage("Не удалось перевести ученика.");
    }
  }

  async function payment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!amountUzs) return;
    if (!window.confirm("Зафиксировать эту оплату как полученную?")) return;
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/enrollments/" + enrollmentId + "/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUzs: Number(amountUzs),
          paidAt: paidAt || null
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(errors[payload.error] ?? "Не удалось записать оплату.");
        return;
      }
      window.location.reload();
    } catch {
      setState("error");
      setMessage("Не удалось записать оплату.");
    }
  }

  if (ended) return null;

  return (
    <div className="student-admin-actions">
      <form className="admin-group-editor" onSubmit={transfer}>
        <div className="admin-panel-head"><h3>Перевод между группами</h3></div>
        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Новая группа</span>
            <select value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
              <option value="">Выберите группу</option>
              {groups.filter((g) => g.id !== currentGroupId).map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name} · {g.sport} · {g.branch} · свободно {g.free}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Причина перевода</span>
            <input value={transferReason} placeholder="Смена времени, возрастной группы…" onChange={(e) => setTransferReason(e.target.value)} />
          </label>
        </div>
        <div className="admin-editor-actions">
          <button className="button" disabled={state === "saving" || !targetGroupId}>Перевести</button>
        </div>
      </form>

      <form className="admin-group-editor" onSubmit={payment}>
        <div className="admin-panel-head"><h3>Ручная оплата абонемента</h3></div>
        <div className="admin-editor-grid">
          <label className="admin-field">
            <span>Сумма, UZS</span>
            <input type="number" min={1} step={1000} value={amountUzs} onChange={(e) => setAmountUzs(e.target.value)} />
          </label>
          <label className="admin-field">
            <span>Дата оплаты</span>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </label>
        </div>
        <div className="admin-editor-actions">
          <button className="button primary" disabled={state === "saving" || !amountUzs}>Записать оплату</button>
          {message ? <span className="admin-save-message error">{message}</span> : null}
        </div>
      </form>
    </div>
  );
}
