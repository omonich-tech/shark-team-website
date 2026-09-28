"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <main className="page-main">
          <section className="service-state">
            <p className="eyebrow">SHARK TEAM</p>
            <h1>Сервис временно недоступен</h1>
            <p>
              Попробуйте повторить действие. Технические детали ошибки
              пользователю не отображаются.
            </p>
            <button className="button primary" onClick={reset}>
              Повторить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
