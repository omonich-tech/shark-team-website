import type { School117PublicData } from "@/server/public-data/school-117";
import {
  formatUzs,
  pickLocalized,
  weekdayLabel,
  type PublicLocale
} from "@/lib/public-i18n";

export function GroupGrid({
  data,
  locale
}: {
  data: School117PublicData;
  locale: PublicLocale;
}) {
  return (
    <div className="group-grid">
      {data.groups.map((group) => {
        const schedule = group.schedule;
        const days = schedule
          .map((item) => weekdayLabel(item.weekday, locale))
          .join(" / ");
        const time = schedule[0]
          ? `${schedule[0].start}–${schedule[0].end}`
          : "—";

        return (
          <article className="group-card" key={group.id}>
            <p className="group-age">
              {locale === "ru"
                ? `${group.ageMin}–${group.ageMax} лет`
                : `${group.ageMin}–${group.ageMax} yosh`}
            </p>
            <h3>{time}</h3>
            <p>{days}</p>
            <span>
              {locale === "ru"
                ? `До ${group.capacityRegular} детей`
                : `${group.capacityRegular} nafargacha`}
            </span>
          </article>
        );
      })}
    </div>
  );
}

export function PriceCards({
  data,
  locale
}: {
  data: School117PublicData;
  locale: PublicLocale;
}) {
  return (
    <div className="price-grid">
      <article className="price-card">
        <span>{locale === "ru" ? "Пробное занятие" : "Sinov mashg‘uloti"}</span>
        <strong>
          {data.prices.trial
            ? formatUzs(data.prices.trial.amount, locale)
            : "—"}
        </strong>
        <p>
          {locale === "ru"
            ? "Оплачивается отдельно."
            : "Alohida to‘lanadi."}
        </p>
      </article>

      <article className="price-card featured">
        <span>{locale === "ru" ? "Абонемент" : "Abonement"}</span>
        <strong>
          {data.prices.subscription
            ? formatUzs(data.prices.subscription.amount, locale)
            : "—"}
        </strong>
        <p>{locale === "ru" ? "В месяц." : "Oyiga."}</p>
      </article>
    </div>
  );
}

export function CoachCard({
  data,
  locale
}: {
  data: School117PublicData;
  locale: PublicLocale;
}) {
  const coach = data.groups[0]?.coach;

  if (!coach) {
    return null;
  }

  const name = [coach.firstName, coach.lastName].filter(Boolean).join(" ");
  const photo = data.media.find(
    (item) =>
      item.targetType === "COACH" &&
      item.targetId === coach.id &&
      item.contentType?.startsWith("image/")
  );

  return (
    <article className="coach-card">
      {photo ? (
        <div
          className="coach-placeholder coach-photo"
          role="img"
          aria-label={
            (locale === "ru" ? photo.alt.ru : photo.alt.uz) ??
            name
          }
          style={{
            backgroundImage: `url("${photo.url}")`
          }}
        />
      ) : (
        <div className="coach-placeholder" aria-hidden="true">
          {coach.firstName.slice(0, 1)}
        </div>
      )}
      <div>
        <p className="eyebrow">{locale === "ru" ? "ТРЕНЕР" : "MURABBIY"}</p>
        <h3>{name}</h3>
        <p>{locale === "ru" ? "Баскетбол" : "Basketbol"}</p>
      </div>
    </article>
  );
}

export function LocationCard({
  data,
  locale
}: {
  data: School117PublicData;
  locale: PublicLocale;
}) {
  return (
    <article className="location-card">
      <p className="eyebrow">{locale === "ru" ? "ФИЛИАЛ" : "FILIAL"}</p>
      <h3>{pickLocalized(locale, data.name)}</h3>
      <p>{pickLocalized(locale, data.district)}</p>
      <p>
        {pickLocalized(locale, data.address)}
        {data.address.postalCode ? `, ${data.address.postalCode}` : ""}
      </p>
      {pickLocalized(locale, data.landmark) ? (
        <p className="muted">{pickLocalized(locale, data.landmark)}</p>
      ) : null}
    </article>
  );
}


export function PublicMediaGallery({
  data,
  locale
}: {
  data: School117PublicData;
  locale: PublicLocale;
}) {
  if (data.media.length === 0) {
    return null;
  }

  return (
    <div className="public-media-grid">
      {data.media.slice(0, 8).map((item) =>
        item.contentType?.startsWith("video/") ? (
          <video
            className="public-media-item"
            key={item.id}
            controls
            preload="metadata"
            src={item.url}
          />
        ) : (
          <a
            className="public-media-item public-media-image"
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={
              (locale === "ru" ? item.alt.ru : item.alt.uz) ??
              (locale === "ru" ? "Фото SHARK TEAM" : "SHARK TEAM surati")
            }
            style={{
              backgroundImage: `url("${item.url}")`
            }}
          />
        )
      )}
    </div>
  );
}
