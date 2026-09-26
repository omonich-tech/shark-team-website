import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
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

const nav = [
  ["/admin", "Dashboard"],
  ["/admin/leads", "Лиды"],
  ["/admin/trials", "Пробные"],
  ["/admin/parents", "Родители"],
  ["/admin/children", "Дети"],
  ["/admin/payments", "Оплаты"],
  ["/admin/branch", "Филиал"],
  ["/admin/coach", "Тренер"],
  ["/admin/groups", "Группы"],
  ["/admin/prices", "Цены"],
  ["/admin/content", "Контент"],
  ["/admin/faq", "FAQ"],
  ["/admin/media", "Медиа"],
  ["/admin/audit", "История"]
] as const;

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

        <nav className="admin-nav">
          {nav.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>

        <AdminLogoutButton />
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
