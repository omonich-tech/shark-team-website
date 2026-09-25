"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);

    try {
      await fetch("/api/admin/logout", {
        method: "POST"
      });
    } finally {
      router.replace("/admin-login");
      router.refresh();
    }
  }

  return (
    <button className="admin-logout" onClick={logout} disabled={loading}>
      {loading ? "Выходим…" : "Выйти"}
    </button>
  );
}
