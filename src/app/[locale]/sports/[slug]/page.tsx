import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentStatus,
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

  if (!sport) notFound();

  const [media, trialPrice, faq] = await Promise.all([
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
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }]
      },
      orderBy: { validFrom: "desc" }
    }),
    prisma.faqItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        sportId: sport.id,
        branchId: null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const hero = media.find((item) => item.contentType?.startsWith("image/"));
  const name = locale === "ru" ? sport.nameRu : sport.nameUz;
  const description =
    locale === "ru"
      ? sport.shortDescriptionRu ?? fallback?.descriptionRu ?? ""
      : sport.shortDescriptionUz ?? fallback?.descriptionUz ?? "";
  const mark =
    fallback?.mark ??
    String(Math.max(1, sport.sortOrder + 1)).padStart(2, "0");

  return (
    <main className="page-main">
      <section className="sport-detail-hero">
        <div className="sport-detail-copy">
          <Link className="shark-back-link" href={`/${locale}/sports`}>
            ← {locale === "ru" ? "Все виды спорта" : "Barcha sport turlari"}
          </Link>
          <p className="eyebrow">SHARK TEAM · {mark}</p>
          <h1>{name}</h1>
          <p className="lead">{description}</p>
          {sport.groups.length ? (
            <div className="hero-actions">
              <Link className="button primary" data-analytics-event="trial_cta_click" href={`/${locale}/trial?sport=${encodeURIComponent(slug)}`}>
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
          <span>{mark}</span>
          <strong>{name}</strong>
        </div>
      </section>

      {sport.groups.length ? (
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
                    <span>{`${group.ageMin}–${group.ageMax} ${locale === "ru" ? "лет" : "yosh"}`}</span>
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
                ? "Группы и расписание для этого направления скоро появятся."
                : "Bu yo‘nalish uchun guruhlar va jadval tez orada paydo bo‘ladi."}
            </p>
          </div>
        </section>
      )}

      {faq.length > 0 ? (
        <section className="content-section">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>
              {locale === "ru"
                ? "Вопросы о направлении"
                : "Yo‘nalish haqida savollar"}
            </h2>
          </div>
          <div className="faq-list shark-faq-list">
            {faq.map((item) => (
              <details className="faq-item" key={item.id}>
                <summary>
                  {locale === "ru" ? item.questionRu : item.questionUz}
                </summary>
                <p>{locale === "ru" ? item.answerRu : item.answerUz}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
