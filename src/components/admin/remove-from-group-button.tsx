"use client";

import { useState } from "react";

export function RemoveFromGroupButton({
  enrollmentId,
  childName,
  paymentUnderReview
}: {
  enrollmentId: string;
  childName: string;
  paymentUnderReview: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function remove() {
    if (
      !window.confirm(
        "Завершить абонемент " + childName + " и убрать из активного состава группы?"
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/enrollments/" + enrollmentId + "/subscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "end",
            reason: "Удалён из активного состава через карточку группы"
          })
        }
      );
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage(
          payload.error === "PAYMENT_UNDER_REVIEW"
            ? "Сначала обработайте оплату на проверке."
            : payload.error ?? "Не удалось убрать ученика."
        );
        return;
      }

      window.location.reload();
    } catch {
      setMessage("Не удалось убрать ученика.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="group-member-remove">
      <button
        type="button"
        className="admin-danger-link"
        disabled={saving || paymentUnderReview}
        onClick={() => void remove()}
      >
        {saving ? "Удаляем…" : "Убрать из группы"}
      </button>
      {message ? <small className="admin-save-message error">{message}</small> : null}
    </div>
  );
}
