import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main">
      <section className="service-state">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>Страница не найдена</h1>
        <p>
          Запрошенной страницы нет или она больше не опубликована.
        </p>
        <Link className="button primary" href="/ru">
          На главную
        </Link>
      </section>
    </main>
  );
}
