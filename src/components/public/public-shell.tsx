import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicLocale } from "@/lib/public-i18n";

const labels = {
  ru: {
    basketball: "Баскетбол",
    branch: "Филиал",
    schedule: "Расписание",
    prices: "Цены",
    coaches: "Тренер",
    trial: "Пробное",
    language: "UZ"
  },
  uz: {
    basketball: "Basketbol",
    branch: "Filial",
    schedule: "Jadval",
    prices: "Narxlar",
    coaches: "Murabbiy",
    trial: "Sinov",
    language: "RU"
  }
} as const;

export function PublicShell({
  locale,
  children
}: {
  locale: PublicLocale;
  children: ReactNode;
}) {
  const copy = labels[locale];
  const otherLocale = locale === "ru" ? "uz" : "ru";

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={`/${locale}`}>
            <span className="brand-mark">S</span>
            <span>SHARK TEAM</span>
          </Link>

          <nav className="site-nav" aria-label="Primary navigation">
            <Link href={`/${locale}/basketball`}>{copy.basketball}</Link>
            <Link href={`/${locale}/branches/school-117`}>{copy.branch}</Link>
            <Link href={`/${locale}/schedule`}>{copy.schedule}</Link>
            <Link href={`/${locale}/prices`}>{copy.prices}</Link>
            <Link href={`/${locale}/coaches`}>{copy.coaches}</Link>
            <Link href={`/${locale}/trial`}>{copy.trial}</Link>
          </nav>

          <Link className="language-switch" href={`/${otherLocale}`}>
            {copy.language}
          </Link>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <div>
          <strong>SHARK TEAM</strong>
          <p>
            {locale === "ru"
              ? "Детские спортивные секции в Ташкенте."
              : "Toshkentdagi bolalar sport seksiyalari."}
          </p>
        </div>
        <span>© 2026 SHARK TEAM</span>
      </footer>
    </>
  );
}

export function DataUnavailable({ locale }: { locale: PublicLocale }) {
  return (
    <main className="page-main">
      <section className="service-state">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>
          {locale === "ru"
            ? "Данные филиала временно недоступны"
            : "Filial ma’lumotlari vaqtincha mavjud emas"}
        </h1>
        <p>
          {locale === "ru"
            ? "Сайт работает, но постоянная база данных ещё не подключена или временно недоступна."
            : "Sayt ishlamoqda, ammo doimiy ma’lumotlar bazasi hali ulanmagan yoki vaqtincha mavjud emas."}
        </p>
      </section>
    </main>
  );
}
