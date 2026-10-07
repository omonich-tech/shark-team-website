import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUzs, isPublicLocale, pickLocalized, weekdayLabel } from "@/lib/public-i18n";
import { tryGetBranchPublicData } from "@/server/public-data/branch";

export const dynamic = "force-dynamic";

export default async function PublicBranchPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isPublicLocale(locale)) notFound();

  const data = await tryGetBranchPublicData(slug);
  if (!data) notFound();

  const hero = data.media.find(
    (item) =>
      item.targetType === "BRANCH" &&
      item.targetId === data.id &&
      item.contentType?.startsWith("image/")
  );
  const coaches = Array.from(
    new Map(
      data.groups.map((group) => [
        group.coach.id,
        group.coach
      ])
    ).values()
  );

  return (
    <main className="page-main">
      <section className="branch-detail-hero">
        <div>
          <Link className="shark-back-link" href={`/${locale}/branches`}>
            ← {locale === "ru" ? "Все филиалы" : "Barcha filiallar"}
          </Link>
          <p className="eyebrow">SHARK TEAM · TASHKENT</p>
          <h1>{pickLocalized(locale, data.name)}</h1>
          <p className="lead">
            {pickLocalized(locale, data.district)}
            {pickLocalized(locale, data.landmark)
              ? ` · ${pickLocalized(locale, data.landmark)}`
              : ""}
          </p>
          <div className="hero-actions">
            <Link className="button primary" data-analytics-event="trial_cta_click" href={`/${locale}/trial?branch=${encodeURIComponent(slug)}`}>
              {locale === "ru" ? "Записаться на пробное" : "Sinovga yozilish"}
            </Link>
          </div>
        </div>
        <div
          className={hero ? "branch-detail-photo has-photo" : "branch-detail-photo"}
          style={hero ? { backgroundImage: `url("${hero.url}")` } : undefined}
        />
      </section>

      <section className="content-section">
        <div className="branch-info-strip">
          <div>
            <span>{locale === "ru" ? "Адрес" : "Manzil"}</span>
            <strong>{pickLocalized(locale, data.address)}</strong>
          </div>
          <div>
            <span>{locale === "ru" ? "Ориентир" : "Mo‘ljal"}</span>
            <strong>{pickLocalized(locale, data.landmark) || "—"}</strong>
          </div>
          <div>
            <span>{locale === "ru" ? "Направления" : "Yo‘nalishlar"}</span>
            <strong>{data.sports.map((sport) => pickLocalized(locale, sport.name)).join(" · ")}</strong>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">{locale === "ru" ? "ГРУППЫ" : "GURUHLAR"}</p>
          <h2>{locale === "ru" ? "Расписание" : "Jadval"}</h2>
        </div>
        <div className="sport-group-list">
          {data.groups.map((group) => (
            <article className="sport-group-row" key={group.id}>
              <div>
                <span>{`${pickLocalized(locale, group.sport.name)} · ${group.ageMin}–${group.ageMax} ${locale === "ru" ? "лет" : "yosh"}`}</span>
                <h3>
                  {group.schedule[0]
                    ? `${group.schedule[0].start}–${group.schedule[0].end}`
                    : "—"}
                </h3>
                <p>
                  {group.schedule.map((item) => weekdayLabel(item.weekday, locale)).join(" · ")}
                </p>
              </div>
              <div className="sport-group-meta">
                <span>
                  {locale === "ru" ? "Тренер" : "Murabbiy"} ·{" "}
                  {[group.coach.firstName, group.coach.lastName].filter(Boolean).join(" ")}
                </span>
                <strong>
                  {locale === "ru" ? "До" : "Gacha"} {group.capacityRegular}
                </strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section">
        <div>
          <div className="section-heading"><h2>{locale === "ru" ? "Тренеры" : "Murabbiylar"}</h2></div>
          <div className="branch-mini-list">
            {coaches.map((coach) => (
              <div className="branch-mini-card" key={coach.id}>
                <span className="branch-mini-avatar">{coach.firstName.slice(0, 1)}</span>
                <strong>{[coach.firstName, coach.lastName].filter(Boolean).join(" ")}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-heading"><h2>{locale === "ru" ? "Стоимость" : "Narxlar"}</h2></div>
          <div className="price-grid">
            <article className="price-card">
              <span>{locale === "ru" ? "Пробное" : "Sinov"}</span>
              <strong>{data.prices.trial ? formatUzs(data.prices.trial.amount, locale) : "—"}</strong>
            </article>
            <article className="price-card featured">
              <span>{locale === "ru" ? "Абонемент" : "Abonement"}</span>
              <strong>{data.prices.subscription ? formatUzs(data.prices.subscription.amount, locale) : "—"}</strong>
            </article>
          </div>
        </div>
      </section>

      {data.media.length > 0 ? (
        <section className="content-section">
          <div className="section-heading"><h2>{locale === "ru" ? "Фото и видео" : "Foto va video"}</h2></div>
          <div className="public-media-grid">
            {data.media.slice(0, 8).map((item) =>
              item.contentType?.startsWith("video/") ? (
                <video className="public-media-item" key={item.id} controls preload="metadata" src={item.url} />
              ) : (
                <a
                  className="public-media-item public-media-image"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  key={item.id}
                  style={{ backgroundImage: `url("${item.url}")` }}
                />
              )
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
