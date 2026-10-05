import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicLocale } from "@/lib/public-i18n";
import { ThemeToggle } from "@/components/public/theme-toggle";
import { tryGetPublishedContentPage } from "@/server/public-data/content-page";

const labels = {
  ru: {
    home: "Главная",
    sports: "Виды спорта",
    branches: "Филиалы",
    coaches: "Тренеры",
    about: "О нас",
    contacts: "Контакты",
    trial: "Пробное",
    language: "UZ",
    menu: "Меню"
  },
  uz: {
    home: "Bosh sahifa",
    sports: "Sport turlari",
    branches: "Filiallar",
    coaches: "Murabbiylar",
    about: "Biz haqimizda",
    contacts: "Kontaktlar",
    trial: "Sinov",
    language: "RU",
    menu: "Menyu"
  }
} as const;

export async function PublicShell({
  locale,
  children
}: {
  locale: PublicLocale;
  children: ReactNode;
}) {
  const copy = labels[locale];
  const otherLocale = locale === "ru" ? "uz" : "ru";
  const brandPage = await tryGetPublishedContentPage("brand");
  const brandLogo =
    brandPage?.media.find(
      (item) => item.isPrimary && item.contentType?.startsWith("image/")
    ) ??
    brandPage?.media.find((item) => item.contentType?.startsWith("image/")) ??
    null;

  const nav = [
    [`/${locale}`, copy.home],
    [`/${locale}/sports`, copy.sports],
    [`/${locale}/branches`, copy.branches],
    [`/${locale}/coaches`, copy.coaches],
    [`/${locale}/about`, copy.about],
    [`/${locale}/contacts`, copy.contacts]
  ] as const;

  return (
    <div className="public-site">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href={`/${locale}`} aria-label="SHARK TEAM">
            {brandLogo ? (
              <span
                className="brand-logo-image"
                role="img"
                aria-label={
                  (locale === "ru" ? brandLogo.altRu : brandLogo.altUz) ??
                  "SHARK TEAM"
                }
                style={{ backgroundImage: `url("${brandLogo.url}")` }}
              />
            ) : (
              <>
                <span className="brand-mark" aria-hidden="true">▲</span>
                <span className="brand-word">
                  <strong>SHARK</strong>
                  <small>TEAM</small>
                </span>
              </>
            )}
          </Link>

          <nav className="site-nav" aria-label="Primary navigation">
            {nav.map(([href, label]) => (
              <Link href={href} key={href}>{label}</Link>
            ))}
          </nav>

          <div className="site-header-actions">
            <ThemeToggle />
            <Link className="language-switch" href={`/${otherLocale}`}>
              {copy.language}
            </Link>
            <Link className="button primary header-trial" href={`/${locale}/trial`}>
              {copy.trial}
            </Link>

            <details className="mobile-menu">
              <summary aria-label={copy.menu}>☰</summary>
              <div className="mobile-menu-panel">
                {nav.map(([href, label]) => (
                  <Link href={href} key={href}>{label}</Link>
                ))}
                <Link className="button primary" href={`/${locale}/trial`}>
                  {copy.trial}
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <div className="site-footer-brand">
          <Link className="brand" href={`/${locale}`} aria-label="SHARK TEAM">
            {brandLogo ? (
              <span
                className="brand-logo-image footer-brand-logo-image"
                role="img"
                aria-label={
                  (locale === "ru" ? brandLogo.altRu : brandLogo.altUz) ??
                  "SHARK TEAM"
                }
                style={{ backgroundImage: `url("${brandLogo.url}")` }}
              />
            ) : (
              <>
                <span className="brand-mark" aria-hidden="true">▲</span>
                <span className="brand-word">
                  <strong>SHARK</strong>
                  <small>TEAM</small>
                </span>
              </>
            )}
          </Link>
          <p>
            {locale === "ru"
              ? "Детские спортивные секции в Ташкенте."
              : "Toshkentdagi bolalar sport seksiyalari."}
          </p>
        </div>

        <div className="site-footer-links">
          <Link href={`/${locale}/sports`}>{copy.sports}</Link>
          <Link href={`/${locale}/branches`}>{copy.branches}</Link>
          <Link href={`/${locale}/coaches`}>{copy.coaches}</Link>
          <Link href={`/${locale}/about`}>{copy.about}</Link>
          <Link href={`/${locale}/contacts`}>{copy.contacts}</Link>
          <Link href={`/${locale}/trial`}>{copy.trial}</Link>
        </div>

        <span>© 2026 SHARK TEAM</span>
      </footer>
    </div>
  );
}

export function DataUnavailable({ locale }: { locale: PublicLocale }) {
  return (
    <main className="page-main">
      <section className="service-state">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>
          {locale === "ru"
            ? "Данные временно недоступны"
            : "Ma’lumotlar vaqtincha mavjud emas"}
        </h1>
        <p>
          {locale === "ru"
            ? "Сайт работает, но база данных временно недоступна. Попробуйте ещё раз немного позже."
            : "Sayt ishlamoqda, ammo ma’lumotlar bazasi vaqtincha mavjud emas. Birozdan keyin qayta urinib ko‘ring."}
        </p>
      </section>
    </main>
  );
}
