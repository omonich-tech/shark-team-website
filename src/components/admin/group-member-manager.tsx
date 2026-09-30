"use client";

import { useMemo, useState } from "react";

type EnrollmentOption = {
  id: string;
  groupId: string;
  groupName: string;
  sport: string;
  branch: string;
};

type Candidate = {
  childId: string;
  name: string;
  parentName: string;
  phone: string;
  enrollments: EnrollmentOption[];
};

const errors: Record<string, string> = {
  CHILD_REQUIRED: "Выберите ученика.",
  GROUP_UNAVAILABLE: "Группа сейчас недоступна.",
  GROUP_CLOSED: "Набор в группу закрыт.",
  GROUP_FULL: "В группе нет свободных мест.",
  ALREADY_MEMBER: "Ученик уже состоит в этой группе.",
  SUBSCRIPTION_PRICE_MISSING: "Для группы не настроена цена абонемента.",
  TRIAL_CONVERSION_REQUIRED:
    "У ребёнка нет завершённого пробного/конверсии. Сначала проведите его через пробное занятие.",
  TARGET_GROUP_FULL: "В группе нет свободных мест.",
  TARGET_GROUP_CLOSED: "Набор в группу закрыт.",
  PAYMENT_UNDER_REVIEW: "У ученика есть оплата на проверке.",
  ALREADY_IN_TARGET_GROUP: "Ученик уже состоит в этой группе."
};

export function GroupMemberManager({
  groupId,
  candidates
}: {
  groupId: string;
  candidates: Candidate[];
}) {
  const [childId, setChildId] = useState("");
  const [sourceEnrollmentId, setSourceEnrollmentId] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const selected = useMemo(
    () => candidates.find((item) => item.childId === childId) ?? null,
    [candidates, childId]
  );

  function selectChild(value: string) {
    setChildId(value);
    const child = candidates.find((item) => item.childId === value);
    setSourceEnrollmentId(child?.enrollments[0]?.id ?? "");
    setMessage("");
  }

  async function addAdditional() {
    if (!childId) return;
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/groups/" + groupId + "/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(errors[payload.error] ?? payload.error ?? "Не удалось добавить ученика.");
        return;
      }

      window.location.reload();
    } catch {
      setState("error");
      setMessage("Не удалось добавить ученика.");
    }
  }

  async function transfer() {
    if (!sourceEnrollmentId) return;
    if (!window.confirm("Перевести выбранного ученика в эту группу?")) return;

    setState("saving");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/enrollments/" + sourceEnrollmentId + "/transfer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetGroupId: groupId,
            reason: "Перевод из карточки группы"
          })
        }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setState("error");
        setMessage(errors[payload.error] ?? payload.error ?? "Не удалось перевести ученика.");
        return;
      }

      window.location.reload();
    } catch {
      setState("error");
      setMessage("Не удалось перевести ученика.");
    }
  }

  return (
    <div className="group-member-manager">
      <div className="admin-editor-grid">
        <label className="admin-field">
          <span>Ученик</span>
          <select value={childId} onChange={(event) => selectChild(event.target.value)}>
            <option value="">Выберите ученика</option>
            {candidates.map((candidate) => (
              <option value={candidate.childId} key={candidate.childId}>
                {candidate.name} · {candidate.parentName}
              </option>
            ))}
          </select>
        </label>

        {selected?.enrollments.length ? (
          <label className="admin-field">
            <span>Текущая группа для перевода</span>
            <select
              value={sourceEnrollmentId}
              onChange={(event) => setSourceEnrollmentId(event.target.value)}
            >
              {selected.enrollments.map((enrollment) => (
                <option value={enrollment.id} key={enrollment.id}>
                  {enrollment.groupName} · {enrollment.sport} · {enrollment.branch}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="admin-field">
            <span>Текущий статус</span>
            <strong>Нет активной группы</strong>
          </div>
        )}
      </div>

      {selected ? (
        <div className="group-member-candidate-summary">
          <span>{selected.parentName}</span>
          <span>{selected.phone}</span>
          <span>
            {selected.enrollments.length
              ? "Активных секций: " + selected.enrollments.length
              : "Нет активных секций"}
          </span>
        </div>
      ) : null}

      <div className="admin-editor-actions">
        {selected?.enrollments.length ? (
          <button
            className="button"
            type="button"
            disabled={state === "saving" || !sourceEnrollmentId}
            onClick={() => void transfer()}
          >
            Перевести в эту группу
          </button>
        ) : null}

        <button
          className="button primary"
          type="button"
          disabled={state === "saving" || !childId}
          onClick={() => void addAdditional()}
        >
          {selected?.enrollments.length
            ? "Добавить как дополнительную секцию"
            : "Добавить в группу"}
        </button>

        {message ? (
          <span className="admin-save-message error">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
