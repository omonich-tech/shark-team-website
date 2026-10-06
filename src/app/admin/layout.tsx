import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { requireAdminSession } from "@/server/admin/auth";

export const metadata: Metadata = {
  title: {
    default: "SHARK TEAM CRM",
    template: "%s | SHARK TEAM CRM"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminSession();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <Link className="admin-brand" href="/admin">
            <span className="brand-mark">S</span>
            <span>SHARK TEAM</span>
          </Link>
          <p className="admin-role">CRM · {session.sub}</p>
        </div>

        <AdminSidebarNav />

        <AdminLogoutButton />
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
