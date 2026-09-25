"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CoachLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);

    try {
      await fetch("/api/coach/logout", {
        method: "POST"
      });
    } finally {
      router.replace("/coach-login");
      router.refresh();
    }
  }

  return (
    <button className="coach-logout" onClick={logout} disabled={loading}>
      {loading ? "Выходим…" : "Выйти"}
    </button>
  );
}
