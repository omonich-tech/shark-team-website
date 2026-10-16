import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/public/json-ld";
import { notFound } from "next/navigation";
import {
  ContentStatus,
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType,
  PriceProductType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  PUBLIC_BRANCH_WHERE,
  PUBLIC_COACH_WHERE
} from "@/server/public-data/visibility";
import {
  activePriceWhere,
  resolveEffectivePrice
} from "@/server/public-data/pricing";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";
import { getSportCatalogEntry } from "@/lib/sport-catalog";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPublicMetadata,
  faqJsonLd
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isPublicLocale(locale)) return {};

  const prisma = getPrisma();
  const sport = await prisma.sport.findFirst({
    where: { slug, status: LifecycleStatus.ACTIVE }
  });

  if (!sport) return {};

  const image = await prisma.mediaAsset.findFirst({
    where: {
      targetType: MediaTargetType.SPORT,
      targetId: sport.id,
      contentType: { startsWith: "image/" },
      OR: [
        { containsMinors: false },
        {
          containsMinors: true,
          consentStatus: MediaConsentStatus.APPROVED
        }
      ]
    },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }]
  });

  const name = locale === "ru" ? sport.nameRu : sport.nameUz;
  const title =
    (locale === "ru" ? sport.seoTitleRu : sport.seoTitleUz) ??
    (locale === "ru"
      ? `${name} для детей в Ташкенте`
      : `Toshkentda bolalar uchun ${name}`);
  const description =
    (locale === "ru"
      ? sport.seoDescriptionRu
      : sport.seoDescriptionUz) ??
    (locale === "ru"
      ? sport.shortDescriptionRu
      : sport.shortDescriptionUz) ??
    (locale === "ru"
      ? `${name} в SHARK TEAM: группы по возрасту, тренеры, филиалы и запись на пробное занятие в Ташкенте.`
      : `SHARK TEAM’da ${name}: yosh guruhlari, murabbiylar, filiallar va sinov mashg‘ulotiga yozilish.`);

  return buildPublicMetadata({
    locale,
    path: `/sports/${slug}`,
    title,
    description,
    images: image ? [image.url] : []
  });
}

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
      branchLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          branch: PUBLIC_BRANCH_WHERE
        },
        include: { branch: true }
      },
      coachLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          coach: PUBLIC_COACH_WHERE
        },
        include: {
          coach: {
            include: {
              branchLinks: {
                where: {
                  status: LifecycleStatus.ACTIVE,
                  branch: PUBLIC_BRANCH_WHERE
                },
                include: { branch: true }
              }
            }
          }
        }
      },
      groups: {
        where: {
          status: LifecycleStatus.ACTIVE,
          branch: PUBLIC_BRANCH_WHERE,
          primaryCoach: PUBLIC_COACH_WHERE
        },
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

  const [media, prices, faqItems] = await Promise.all([
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
    prisma.price.findMany({
      where: {
        ...activePriceWhere(),
        OR: [
          { sportId: sport.id },
          { sportId: null }
        ]
      },
      orderBy: { validFrom: "desc" }
    }),
    prisma.faqItem.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        sportId: sport.id
      },
      include: { branch: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const faq = faqItems.filter(
    (item) =>
      !item.branch ||
      item.branch.status === LifecycleStatus.ACTIVE
  );
  const hero = media.find((item) => item.contentType?.startsWith("image/"));
  const name = locale === "ru" ? sport.nameRu : sport.nameUz;
  const description =
    locale === "ru"
      ? sport.shortDescriptionRu ?? fallback?.descriptionRu ?? ""
      : sport.shortDescriptionUz ?? fallback?.descriptionUz ?? "";
  const mark =
    fallback?.mark ??
    String(Math.max(1, sport.sortOrder + 1)).padStart(2, "0");
  const story = fallback?.story[locale === "ru" ? "ru" : "uz"] ?? null;
  const branches = sport.branchLinks.map((link) => link.branch);
  const coaches = sport.coachLinks.map((link) => link.coach);

  const structuredData = [
    breadcrumbJsonLd([
      {
        name: "SHARK TEAM",
        path: `/${locale}`
      },
      {
        name: locale === "ru" ? "Виды спорта" : "Sport turlari",
        path: `/${locale}/sports`
      },
      {
        name,
        path: `/${locale}/sports/${slug}`
      }
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name,
      description,
      url: absoluteUrl(`/${locale}/sports/${slug}`),
      provider: {
        "@type": "SportsOrganization",
        name: "SHARK TEAM",
        url: absoluteUrl(`/${locale}`)
      },
      areaServed: {
        "@type": "City",
        name: locale === "ru" ? "Ташкент" : "Toshkent"
      },
      image: hero?.url
    },
    ...(faq.length
      ? [
          faqJsonLd(
            faq.map((item) => ({
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
      <section className="sport-detail-hero">
        <div className="sport-detail-copy">
          <Link className="shark-back-link" href={`/${locale}/sports`}>
            ← {locale === "ru" ? "Все виды спорта" : "Barcha sport turlari"}
          </Link>
          <p className="eyebrow">SHARK TEAM · {mark}</p>
          <h1>{name}</h1>
          <p className="lead">{story?.heroLead ?? description}</p>
          {story ? (
            <div className="sport-trait-list" aria-label={locale === "ru" ? "Ключевые качества спорта" : "Sportning asosiy jihatlari"}>
              {story.traits.map((trait) => (
                <span key={trait}>{trait}</span>
              ))}
            </div>
          ) : null}
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

      {branches.length ? (
        <section className="content-section">
          <div className="section-heading">
            <p className="eyebrow">{locale === "ru" ? "ГДЕ ЗАНИМАТЬСЯ" : "QAYERDA MASHG‘ULOT"}</p>
            <h2>{locale === "ru" ? "Филиалы с этим направлением" : "Bu yo‘nalish mavjud filiallar"}</h2>
          </div>
          <div className="sport-branch-grid">
            {branches.map((branch) => {
              const branchName =
                locale === "ru" ? branch.publicNameRu : branch.publicNameUz;
              const district =
                locale === "ru" ? branch.districtRu : branch.districtUz;
              const address =
                locale === "ru" ? branch.addressRu : branch.addressUz;
              const workingHours =
                locale === "ru" ? branch.workingHoursRu : branch.workingHoursUz;
              const hasActiveGroup = sport.groups.some(
                (group) => group.branchId === branch.id
              );

              return (
                <Link
                  className="sport-branch-card"
                  href={`/${locale}/branches/${branch.slug}`}
                  key={branch.id}
                >
                  <div>
                    <span className="sport-branch-status">
                      {hasActiveGroup
                        ? locale === "ru"
                          ? "Есть активная группа"
                          : "Faol guruh bor"
                        : locale === "ru"
                          ? "Филиал подключён"
                          : "Filial ulangan"}
                    </span>
                    <h3>{branchName}</h3>
                    <p>{[district, address].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="sport-branch-hours">
                    <span>{locale === "ru" ? "Дни и время работы" : "Ish kunlari va vaqti"}</span>
                    <strong>{workingHours || "—"}</strong>
                    <small>
                      {hasActiveGroup
                        ? locale === "ru"
                          ? "Открыть филиал и расписание →"
                          : "Filial va jadvalni ochish →"
                        : locale === "ru"
                          ? "Расписание группы появится после её создания →"
                          : "Guruh jadvali yaratilgandan keyin chiqadi →"}
                    </small>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {coaches.length ? (
        <section className="content-section">
          <div className="section-heading shark-section-heading">
            <div>
              <p className="eyebrow">{locale === "ru" ? "ТРЕНЕРЫ" : "MURABBIYLAR"}</p>
              <h2>
                {locale === "ru"
                  ? "Кто ведёт это направление"
                  : "Bu yo‘nalishni kim olib boradi"}
              </h2>
            </div>
            <Link className="shark-text-link" href={`/${locale}/coaches`}>
              {locale === "ru" ? "Все тренеры →" : "Barcha murabbiylar →"}
            </Link>
          </div>

          <div className="shark-coach-grid">
            {coaches.map((coach) => (
              <Link
                className="shark-coach-card shark-coach-card-link"
                href={`/${locale}/coaches/${coach.id}`}
                key={coach.id}
              >
                <div className="shark-coach-photo">
                  <span>{coach.firstName.slice(0, 1)}</span>
                </div>
                <div>
                  <h3>
                    {[coach.firstName, coach.lastName].filter(Boolean).join(" ")}
                  </h3>
                  <p>
                    {coach.branchLinks.length
                      ? coach.branchLinks
                          .map((item) =>
                            locale === "ru"
                              ? item.branch.publicNameRu
                              : item.branch.publicNameUz
                          )
                          .join(" · ")
                      : locale === "ru"
                        ? "Филиал уточняется"
                        : "Filial aniqlanmoqda"}
                  </p>
                  {coach.experienceYears ? (
                    <span>
                      {locale === "ru"
                        ? `Опыт ${coach.experienceYears}+ лет`
                        : `Tajriba ${coach.experienceYears}+ yil`}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {story ? (
        <>
          <section className="content-section sport-story-section">
            <div className="section-heading sport-story-heading">
              <p className="eyebrow">
                {locale === "ru" ? "ПОЧЕМУ ЭТО ИНТЕРЕСНО" : "NEGA BU QIZIQ"}
              </p>
              <h2>
                {locale === "ru"
                  ? `Почему ${name.toLowerCase()} может по-настоящему увлечь`
                  : `${name} nimasi bilan qiziqtirishi mumkin`}
              </h2>
              <p>
                {locale === "ru"
                  ? "Не список абстрактных преимуществ, а то, что ребёнок реально чувствует на тренировке."
                  : "Shunchaki afzalliklar ro‘yxati emas — bola mashg‘ulotda haqiqatan his qiladigan narsalar."}
              </p>
            </div>

            <div className="sport-story-card-grid">
              {story.why.map((item, index) => (
                <article className="sport-story-card" key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="content-section sport-story-development">
            <div className="sport-story-duo">
              <article className="sport-story-panel">
                <p className="eyebrow">{locale === "ru" ? "ТЕЛО" : "JISMONIY RIVOJLANISH"}</p>
                <h2>{locale === "ru" ? "Что развивает физически" : "Jismonan nimalarni rivojlantiradi"}</h2>
                <ul className="sport-benefit-list">
                  {story.physical.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="sport-story-panel sport-story-panel-dark">
                <p className="eyebrow">{locale === "ru" ? "ХАРАКТЕР" : "XARAKTER"}</p>
                <h2>{locale === "ru" ? "Что тренирует в характере" : "Xarakterda nimalarni shakllantiradi"}</h2>
                <ul className="sport-benefit-list">
                  {story.character.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="content-section">
            <div className="section-heading sport-story-heading">
              <p className="eyebrow">{locale === "ru" ? "ВНУТРИ ТРЕНИРОВКИ" : "MASHG‘ULOT ICHIDA"}</p>
              <h2>{locale === "ru" ? "Как выглядит занятие" : "Mashg‘ulot qanday o‘tadi"}</h2>
            </div>
            <div className="sport-training-grid">
              {story.training.map((step, index) => (
                <article key={step.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="content-section">
            <div className="sport-story-duo sport-story-duo-lists">
              <article className="sport-story-panel">
                <p className="eyebrow">{locale === "ru" ? "НАВЫКИ" : "KO‘NIKMALAR"}</p>
                <h2>
                  {locale === "ru"
                    ? "Чему ребёнок постепенно научится"
                    : "Bola asta-sekin nimalarni o‘rganadi"}
                </h2>
                <ul className="sport-check-list">
                  {story.skills.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="sport-story-panel">
                <p className="eyebrow">{locale === "ru" ? "КОМУ ПОДОЙДЁТ" : "KIMGA MOS"}</p>
                <h2>
                  {locale === "ru"
                    ? "Этот спорт стоит попробовать, если ребёнок…"
                    : "Bu sportni sinab ko‘rish mumkin, agar bola…"}
                </h2>
                <ul className="sport-check-list">
                  {story.fit.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="content-section sport-beginner-strip">
            <div>
              <p className="eyebrow">{locale === "ru" ? "МОЖНО С НУЛЯ" : "NOLDAN BOSHLASH MUMKIN"}</p>
              <h2>{locale === "ru" ? "Опыт до первой тренировки не нужен" : "Birinchi mashg‘ulotgacha tajriba shart emas"}</h2>
            </div>
            <p>{story.beginner}</p>
          </section>

          {sport.groups.length ? (
            <section className="content-section sport-story-cta">
              <div>
                <p className="eyebrow">SHARK TEAM</p>
                <h2>{story.ctaTitle}</h2>
                <p>{story.ctaLead}</p>
              </div>
              <Link
                className="button primary"
                data-analytics-event="trial_cta_click"
                href={`/${locale}/trial?sport=${encodeURIComponent(slug)}`}
              >
                {locale === "ru" ? "Попробовать на тренировке →" : "Mashg‘ulotda sinab ko‘rish →"}
              </Link>
            </section>
          ) : null}
        </>
      ) : null}

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
                    `${weekdayLabel(rule.weekday, locale)} ${minutes(rule.startMinutes)}–${minutes(rule.endMinutes)}`
                )
                .join(" · ");
              const trialPrice = resolveEffectivePrice(
                prices,
                PriceProductType.TRIAL,
                {
                  sportId: sport.id,
                  branchId: group.branchId,
                  groupId: group.id
                }
              );
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
                    <Link href={`/${locale}/coaches/${group.primaryCoach.id}`}>
                      {locale === "ru" ? "Тренер" : "Murabbiy"} ·{" "}
                      {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </Link>
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
                  {item.branch ? (
                    <small className="faq-scope-label">
                      {locale === "ru"
                        ? item.branch.publicNameRu
                        : item.branch.publicNameUz}
                    </small>
                  ) : null}
                </summary>
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
