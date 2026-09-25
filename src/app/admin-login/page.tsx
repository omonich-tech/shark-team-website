import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getAdminSession } from "@/server/admin/auth";

export const metadata: Metadata = {
  title: "SHARK TEAM — CRM Login",
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>CRM</h1>
        <p>Закрытый кабинет управления спортивной секцией.</p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
