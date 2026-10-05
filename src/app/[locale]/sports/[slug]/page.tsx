import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType,
  PriceProductType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";
import { getSportCatalogEntry } from "@/lib/sport-catalog";

export const dynamic = "force-dynamic";

function minutes(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export default async function SportPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isPublicLocale(locale)) notFound();

  const fallback = getSportCatalogEntry(slug);
  if (!fallback) notFound();

  const prisma = getPrisma();
  const sport = await prisma.sport.findFirst({
    where: { slug, status: LifecycleStatus.ACTIVE },
    include: {
      groups: {
        where: { status: LifecycleStatus.ACTIVE },
        include: {
          branch: true,
          primaryCoach: true,
          scheduleRules: {
            where: { status: LifecycleStatus.ACTIVE },
            orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }]
          }
        },
        orderBy: [{ ageMin: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  const [media, trialPrice] = sport
    ? await Promise.all([
        prisma.mediaAsset.findMany({
          where: {
            targetType: MediaTargetType.SPORT,
            targetId: sport.id,
            OR: [
              { containsMinors: false },
              {
                containsMinors: true,
                consentStatus: MediaConsentStatus.APPROVED
              }
            ]
          },
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" }
          ]
        }),
        prisma.price.findFirst({
          where: {
            sportId: sport.id,
            productType: PriceProductType.TRIAL,
            status: LifecycleStatus.ACTIVE,
            validTo: null
          },
          orderBy: { validFrom: "desc" }
        })
      ])
    : [[], null];

  const hero = media.find((item) => item.contentType?.startsWith("image/"));
  const name =
    locale === "ru"
      ? sport?.nameRu ?? fallback.nameRu
      : sport?.nameUz ?? fallback.nameUz;
  const description =
    locale === "ru"
      ? sport?.shortDescriptionRu ?? fallback.descriptionRu
      : sport?.shortDescriptionUz ?? fallback.descriptionUz;

  return (
    <main className="page-main">
      <section className="sport-detail-hero">
        <div className="sport-detail-copy">
          <Link className="shark-back-link" href={`/${locale}/sports`}>
            ← {locale === "ru" ? "Все виды спорта" : "Barcha sport turlari"}
          </Link>
          <p className="eyebrow">SHARK TEAM · {fallback.mark}</p>
          <h1>{name}</h1>
          <p className="lead">{description}</p>
          {sport?.groups.length ? (
            <div className="hero-actions">
              <Link className="button primary" href={`/${locale}/trial`}>
                {locale === "ru" ? "Записаться на пробное" : "Sinovga yozilish"}
              </Link>
              <Link className="button secondary" href={`/${locale}/branches`}>
                {locale === "ru" ? "Выбрать филиал" : "Filialni tanlash"}
              </Link>
            </div>
          ) : null}
        </div>
        <div
          className={hero ? "sport-detail-media has-photo" : "sport-detail-media"}
          style={hero ? { backgroundImage: `url("${hero.url}")` } : undefined}
        >
          <span>{fallback.mark}</span>
          <strong>{name}</strong>
        </div>
      </section>

      {sport?.groups.length ? (
        <section className="content-section">
          <div className="section-heading">
            <p className="eyebrow">{locale === "ru" ? "ГРУППЫ" : "GURUHLAR"}</p>
            <h2>{locale === "ru" ? "Расписание и филиалы" : "Jadval va filiallar"}</h2>
          </div>
          <div className="sport-group-list">
            {sport.groups.map((group) => {
              const schedule = group.scheduleRules
                .map(
                  (rule) =>
                    `${weekdayLabel(rule.weekday, locale)} ${minutes(rule.startMinutes)}`
                )
                .join(" · ");
              return (
                <article className="sport-group-row" key={group.id}>
                  <div>
                    <span>
                      {group.ageMin}–{group.ageMax} {locale === "ru" ? "лет" : "yosh"}
                    </span>
                    <h3>
                      {locale === "ru"
                        ? group.branch.publicNameRu
                        : group.branch.publicNameUz}
                    </h3>
                    <p>{schedule || "—"}</p>
                  </div>
                  <div className="sport-group-meta">
                    <span>
                      {locale === "ru" ? "Тренер" : "Murabbiy"} ·{" "}
                      {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    {trialPrice ? (
                      <strong>
                        {new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "uz-UZ").format(
                          trialPrice.amount
                        )}{" "}
                        UZS
                      </strong>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="content-section">
          <div className="shark-coming-soon">
            <p className="eyebrow">{locale === "ru" ? "НАПРАВЛЕНИЕ" : "YO‘NALISH"}</p>
            <h2>
              {locale === "ru"
                ? "Группы и расписание скоро появятся"
                : "Guruhlar va jadval tez orada paydo bo‘ladi"}
            </h2>
            <p>
              {locale === "ru"
                ? "Как только направление будет открыто в конкретном филиале, оно автоматически появится здесь из админки."
                : "Yo‘nalish ma’lum filialda ochilishi bilan u admin paneldan avtomatik ravishda shu yerda paydo bo‘ladi."}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
