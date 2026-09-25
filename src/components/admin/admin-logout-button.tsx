"use client";

import { useState } from "react";

export function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);

    try {
      await fetch("/api/admin/logout", {
        method: "POST"
      });
    } finally {
      window.location.href = "/admin-login";
    }
  }

  return (
    <button className="admin-logout" onClick={logout} disabled={loading}>
      {loading ? "Выходим…" : "Выйти"}
    </button>
  );
}
