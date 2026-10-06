"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    label: "Обзор",
    items: [
      ["/admin", "Dashboard"],
      ["/admin/assistant", "AI-ассистент"]
    ]
  },
  {
    label: "CRM",
    items: [
      ["/admin/leads", "Лиды"],
      ["/admin/trials", "Пробные"],
      ["/admin/parents", "Родители"],
      ["/admin/children", "Ученики"]
    ]
  },
  {
    label: "Финансы",
    items: [
      ["/admin/payments", "Оплаты"],
      ["/admin/subscriptions", "Абонементы"],
      ["/admin/prices", "Цены"]
    ]
  },
  {
    label: "Спорт",
    items: [
      ["/admin/attendance", "Посещаемость"],
      ["/admin/progress", "Прогресс"],
      ["/admin/sports", "Виды спорта"],
      ["/admin/branches", "Филиалы"],
      ["/admin/coaches", "Тренеры"],
      ["/admin/groups", "Группы"],
      ["/admin/sessions", "Занятия"]
    ]
  },
  {
    label: "Контент",
    items: [
      ["/admin/content", "Контент"],
      ["/admin/faq", "FAQ"],
      ["/admin/media", "Медиа"]
    ]
  },
  {
    label: "Система",
    items: [["/admin/audit", "История"]]
  }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Администрирование">
      {sections.map((section) => (
        <section className="admin-nav-section" key={section.label}>
          <p className="admin-nav-section-title">{section.label}</p>
          <div className="admin-nav-section-links">
            {section.items.map(([href, label]) => {
              const active = isActive(pathname, href);

              return (
                <Link
                  className={active ? "active" : undefined}
                  href={href}
                  key={href}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
