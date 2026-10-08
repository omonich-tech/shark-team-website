import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/public/json-ld";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ContentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { formatUzs, isPublicLocale, pickLocalized, weekdayLabel } from "@/lib/public-i18n";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPublicMetadata,
  faqJsonLd
} from "@/lib/seo";
import { tryGetBranchPublicData } from "@/server/public-data/branch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isPublicLocale(locale)) return {};

  const prisma = getPrisma();
  const branch = await prisma.branch.findFirst({
    where: { slug, status: "ACTIVE" }
  });

  if (!branch) return {};

  const image = await prisma.mediaAsset.findFirst({
    where: {
      targetType: "BRANCH",
      targetId: branch.id,
      contentType: { startsWith: "image/" },
      OR: [
        { containsMinors: false },
        { containsMinors: true, consentStatus: "APPROVED" }
      ]
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
  });

  const name = locale === "ru" ? branch.publicNameRu : branch.publicNameUz;
  const district = locale === "ru" ? branch.districtRu : branch.districtUz;
  const address = locale === "ru" ? branch.addressRu : branch.addressUz;
  const title =
    (locale === "ru" ? branch.seoTitleRu : branch.seoTitleUz) ??
    (locale === "ru"
      ? `${name} — спортивные секции для детей в Ташкенте`
      : `${name} — Toshkentdagi bolalar sport seksiyalari`);
  const description =
    (locale === "ru"
      ? branch.seoDescriptionRu
      : branch.seoDescriptionUz) ??
    (locale === "ru"
      ? `${name}: ${district ? district + ", " : ""}${address}. Спортивные группы SHARK TEAM, тренеры, расписание и пробное занятие.`
      : `${name}: ${district ? district + ", " : ""}${address}. SHARK TEAM guruhlari, murabbiylar, jadval va sinov mashg‘uloti.`);

  return buildPublicMetadata({
    locale,
    path: `/branches/${slug}`,
    title,
    description,
    images: image ? [image.url] : []
  });
}

export default async function PublicBranchPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  await connection();
  if (!isPublicLocale(locale)) notFound();

  const data = await tryGetBranchPublicData(slug);
  if (!data) notFound();

  const prisma = getPrisma();
  const branchFaq = await prisma.faqItem.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      branchId: data.id,
      sportId: null
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

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

  const branchName = pickLocalized(locale, data.name);
  const branchDescription =
    locale === "ru"
      ? `${branchName}: ${pickLocalized(locale, data.address)}. Спортивные группы SHARK TEAM, расписание и пробное занятие.`
      : `${branchName}: ${pickLocalized(locale, data.address)}. SHARK TEAM guruhlari, jadval va sinov mashg‘uloti.`;
  const sportsLabel = data.sports
    .map((sport) => pickLocalized(locale, sport.name))
    .join(" · ");
  const localHeading =
    locale === "ru"
      ? `${sportsLabel} для детей — ${pickLocalized(locale, data.district) || "Ташкент"}`
      : `Bolalar uchun ${sportsLabel} — ${pickLocalized(locale, data.district) || "Toshkent"}`;
  const facilityNotes = pickLocalized(locale, data.facilityNotes);
  const mapUrl = data.coordinates
    ? `https://yandex.uz/maps/?ll=${data.coordinates.longitude}%2C${data.coordinates.latitude}&z=17&pt=${data.coordinates.longitude},${data.coordinates.latitude}`
    : null;

  const schemaDay: Record<string, string> = {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
    SUNDAY: "Sunday"
  };
  const openingByDay = new Map<string, { opens: string; closes: string }>();
  for (const group of data.groups) {
    for (const item of group.schedule) {
      const current = openingByDay.get(item.weekday);
      openingByDay.set(item.weekday, {
        opens: current && current.opens < item.start ? current.opens : item.start,
        closes: current && current.closes > item.end ? current.closes : item.end
      });
    }
  }
  const openingHoursSpecification = Array.from(openingByDay.entries()).map(
    ([weekday, hours]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: schemaDay[weekday] ?? weekday,
      opens: hours.opens,
      closes: hours.closes
    })
  );

  const structuredData = [
    breadcrumbJsonLd([
      { name: "SHARK TEAM", path: `/${locale}` },
      {
        name: locale === "ru" ? "Филиалы" : "Filiallar",
        path: `/${locale}/branches`
      },
      {
        name: branchName,
        path: `/${locale}/branches/${slug}`
      }
    ]),
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      "@id": absoluteUrl(`/${locale}/branches/${slug}#location`),
      name: branchName,
      url: absoluteUrl(`/${locale}/branches/${slug}`),
      description: branchDescription,
      parentOrganization: {
        "@id": absoluteUrl("/#organization"),
        name: "SHARK TEAM"
      },
      areaServed: [
        {
          "@type": "City",
          name: locale === "ru" ? "Ташкент" : "Toshkent"
        },
        ...(pickLocalized(locale, data.district)
          ? [
              {
                "@type": "AdministrativeArea",
                name: pickLocalized(locale, data.district)
              }
            ]
          : [])
      ],
      telephone: data.publicPhone ?? undefined,
      image: hero?.url,
      hasMap: mapUrl ?? undefined,
      openingHoursSpecification:
        openingHoursSpecification.length > 0
          ? openingHoursSpecification
          : undefined,
      address: {
        "@type": "PostalAddress",
        streetAddress: pickLocalized(locale, data.address),
        addressLocality: locale === "ru" ? "Ташкент" : "Toshkent",
        addressRegion: pickLocalized(locale, data.district) || undefined,
        postalCode: data.address.postalCode ?? undefined,
        addressCountry: "UZ"
      },
      geo: data.coordinates
        ? {
            "@type": "GeoCoordinates",
            latitude: data.coordinates.latitude,
            longitude: data.coordinates.longitude
          }
        : undefined
    },
    ...(branchFaq.length
      ? [
          faqJsonLd(
            branchFaq.map((item) => ({
              question:
                locale === "ru" ? item.questionRu : item.questionUz,
              answer: locale === "ru" ? item.answerRu : item.answerUz
            }))
          )
        ]
      : [])
  ];

  return (
    <>
      <JsonLd data={structuredData} />
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
            {mapUrl ? (
              <a
                className="button secondary"
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                {locale === "ru" ? "Открыть на карте" : "Xaritada ochish"}
              </a>
            ) : null}
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
          <div>
            <span>{locale === "ru" ? "Время" : "Vaqt"}</span>
            <strong>{pickLocalized(locale, data.workingHours) || "—"}</strong>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">LOCAL · SHARK TEAM</p>
          <h2>{localHeading}</h2>
        </div>
        <p className="lead">
          {facilityNotes ||
            (locale === "ru"
              ? `Филиал находится по адресу ${pickLocalized(locale, data.address)}. ${pickLocalized(locale, data.landmark) || ""}`
              : `Filial manzili: ${pickLocalized(locale, data.address)}. ${pickLocalized(locale, data.landmark) || ""}`)}
        </p>
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

      {branchFaq.length > 0 ? (
        <section className="content-section">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>
              {locale === "ru"
                ? "Вопросы о филиале"
                : "Filial haqida savollar"}
            </h2>
          </div>
          <div className="faq-list shark-faq-list">
            {branchFaq.map((item) => (
              <details className="faq-item" key={item.id}>
                <summary>{locale === "ru" ? item.questionRu : item.questionUz}</summary>
                <p>{locale === "ru" ? item.answerRu : item.answerUz}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
      </main>
    </>
  );
}
