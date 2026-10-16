import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/public/json-ld";
import { notFound } from "next/navigation";
import {
  EnrollmentStatus,
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildPublicMetadata
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; coachId: string }>;
}): Promise<Metadata> {
  const { locale, coachId } = await params;
  if (!isPublicLocale(locale)) return {};

  const prisma = getPrisma();
  const coach = await prisma.coach.findFirst({
    where: { id: coachId, status: LifecycleStatus.ACTIVE },
    include: {
      sportLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          sport: { status: LifecycleStatus.ACTIVE }
        },
        include: { sport: true }
      }
    }
  });

  if (!coach) return {};

  const image = await prisma.mediaAsset.findFirst({
    where: {
      targetType: MediaTargetType.COACH,
      targetId: coach.id,
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

  const fullName = [coach.firstName, coach.lastName].filter(Boolean).join(" ");
  const sports = coach.sportLinks
    .map((link) =>
      locale === "ru" ? link.sport.nameRu : link.sport.nameUz
    )
    .join(", ");
  const title =
    (locale === "ru" ? coach.seoTitleRu : coach.seoTitleUz) ??
    (locale === "ru"
      ? `Тренер ${fullName} — SHARK TEAM`
      : `Murabbiy ${fullName} — SHARK TEAM`);
  const description =
    (locale === "ru"
      ? coach.seoDescriptionRu
      : coach.seoDescriptionUz) ??
    (locale === "ru" ? coach.publicBioRu : coach.publicBioUz) ??
    (locale === "ru"
      ? `${fullName} — тренер SHARK TEAM${sports ? " по направлениям: " + sports : ""}. Группы, филиалы и запись на пробное занятие.`
      : `${fullName} — SHARK TEAM murabbiyi${sports ? ": " + sports : ""}. Guruhlar, filiallar va sinov mashg‘ulotiga yozilish.`);

  return buildPublicMetadata({
    locale,
    path: `/coaches/${coachId}`,
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

export default async function CoachProfilePage({
  params
}: {
  params: Promise<{ locale: string; coachId: string }>;
}) {
  const { locale, coachId } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const coach = await prisma.coach.findFirst({
    where: {
      id: coachId,
      status: LifecycleStatus.ACTIVE
    },
    include: {
      sportLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          sport: { status: LifecycleStatus.ACTIVE }
        },
        include: { sport: true }
      },
      branchLinks: {
        where: {
          status: LifecycleStatus.ACTIVE,
          branch: { status: LifecycleStatus.ACTIVE }
        },
        include: { branch: true }
      },
      primaryGroups: {
        where: {
          status: LifecycleStatus.ACTIVE,
          branch: { status: LifecycleStatus.ACTIVE },
          sport: { status: LifecycleStatus.ACTIVE }
        },
        include: {
          sport: true,
          branch: true,
          scheduleRules: {
            where: { status: LifecycleStatus.ACTIVE }
          }
        },
        orderBy: [{ branchId: "asc" }, { ageMin: "asc" }]
      }
    }
  });

  if (!coach) notFound();

  const media = await prisma.mediaAsset.findMany({
    where: {
      targetType: MediaTargetType.COACH,
      targetId: coach.id,
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
  });

  const photo = media.find((item) => item.contentType?.startsWith("image/"));
  const fullName = [coach.firstName, coach.lastName].filter(Boolean).join(" ");
  const initials = [coach.firstName, coach.lastName]
    .filter(Boolean)
    .map((value) => value?.slice(0, 1).toUpperCase())
    .join("");
  const bio = locale === "ru" ? coach.publicBioRu : coach.publicBioUz;
  const education = locale === "ru" ? coach.educationRu : coach.educationUz;
  const qualification =
    locale === "ru" ? coach.qualificationRu : coach.qualificationUz;

  const trialGroup = coach.primaryGroups[0];
  const trialSport = trialGroup?.sport.slug ?? coach.sportLinks[0]?.sport.slug;
  const trialBranch =
    trialGroup?.branch.slug ?? coach.branchLinks[0]?.branch.slug;
  const trialHref = trialSport
    ? `/${locale}/trial?sport=${encodeURIComponent(trialSport)}${trialBranch ? `&branch=${encodeURIComponent(trialBranch)}` : ""}`
    : `/${locale}/trial`;

  const structuredData = [
    breadcrumbJsonLd([
      { name: "SHARK TEAM", path: `/${locale}` },
      {
        name: locale === "ru" ? "Тренеры" : "Murabbiylar",
        path: `/${locale}/coaches`
      },
      {
        name: fullName,
        path: `/${locale}/coaches/${coach.id}`
      }
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: fullName,
      url: absoluteUrl(`/${locale}/coaches/${coach.id}`),
      image: photo?.url,
      jobTitle: locale === "ru" ? "Тренер" : "Murabbiy",
      description: bio ?? undefined,
      worksFor: {
        "@type": "SportsOrganization",
        name: "SHARK TEAM",
        url: absoluteUrl(`/${locale}`)
      },
      knowsAbout: coach.sportLinks.map((link) =>
        locale === "ru" ? link.sport.nameRu : link.sport.nameUz
      )
    }
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <main className="page-main coach-profile-v2">
        <section className="coach-hero-v2">
          <div
            className={photo ? "coach-photo-v2 has-photo" : "coach-photo-v2"}
            style={photo ? { backgroundImage: `url("${photo.url}")` } : undefined}
            role={photo ? "img" : undefined}
            aria-label={
              photo
                ? (locale === "ru" ? photo.altRu : photo.altUz) ?? fullName
                : undefined
            }
          >
            {!photo ? (
              <div className="coach-photo-placeholder-v2">
                <span>{initials || coach.firstName.slice(0, 1)}</span>
                <small>SHARK TEAM</small>
              </div>
            ) : null}
          </div>

          <div className="coach-hero-copy-v2">
            <Link className="shark-back-link" href={`/${locale}/coaches`}>
              ← {locale === "ru" ? "Все тренеры" : "Barcha murabbiylar"}
            </Link>

            <p className="eyebrow">
              SHARK TEAM · {locale === "ru" ? "ТРЕНЕР" : "MURABBIY"}
            </p>
            <h1>{fullName}</h1>

            <div className="coach-specialty-list-v2">
              {coach.sportLinks.map((link) => (
                <Link
                  href={`/${locale}/sports/${link.sport.slug}`}
                  key={link.sportId}
                >
                  {locale === "ru" ? link.sport.nameRu : link.sport.nameUz}
                </Link>
              ))}
            </div>

            {bio ? <p className="coach-bio-v2">{bio}</p> : null}

            <div className="coach-hero-actions-v2">
              <Link
                className="button primary"
                data-analytics-event="trial_cta_click"
                href={trialHref}
              >
                {locale === "ru"
                  ? "Записаться на пробное"
                  : "Sinov mashg‘ulotiga yozilish"}
              </Link>
              {coach.branchLinks[0] ? (
                <Link
                  className="button secondary"
                  href={`/${locale}/branches/${coach.branchLinks[0].branch.slug}`}
                >
                  {locale === "ru" ? "Посмотреть филиал" : "Filialni ko‘rish"}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="coach-facts-v2" aria-label={locale === "ru" ? "Кратко о тренере" : "Murabbiy haqida qisqacha"}>
          <article>
            <span>{locale === "ru" ? "Опыт" : "Tajriba"}</span>
            <strong>
              {coach.experienceYears
                ? locale === "ru"
                  ? `${coach.experienceYears}+ лет`
                  : `${coach.experienceYears}+ yil`
                : "—"}
            </strong>
          </article>
          <article>
            <span>{locale === "ru" ? "Направления" : "Yo‘nalishlar"}</span>
            <strong>{coach.sportLinks.length || "—"}</strong>
          </article>
          <article>
            <span>{locale === "ru" ? "Филиалы" : "Filiallar"}</span>
            <strong>{coach.branchLinks.length || "—"}</strong>
          </article>
        </section>

        <section className="content-section coach-professional-v2">
          <article>
            <div>
              <p className="eyebrow">{locale === "ru" ? "ОБРАЗОВАНИЕ" : "TA’LIM"}</p>
              <h2>
                {locale === "ru"
                  ? "Профессиональная база"
                  : "Professional tayyorgarlik"}
              </h2>
            </div>
            <p>
              {education ||
                (locale === "ru"
                  ? "Информация уточняется."
                  : "Ma’lumot aniqlanmoqda.")}
            </p>
          </article>

          <article>
            <div>
              <p className="eyebrow">{locale === "ru" ? "КВАЛИФИКАЦИЯ" : "MALAKA"}</p>
              <h2>
                {locale === "ru"
                  ? "Компетенции тренера"
                  : "Murabbiy kompetensiyalari"}
              </h2>
            </div>
            <p>
              {qualification ||
                (locale === "ru"
                  ? "Информация уточняется."
                  : "Ma’lumot aniqlanmoqda.")}
            </p>
          </article>
        </section>

        {coach.branchLinks.length ? (
          <section className="content-section">
            <div className="section-heading coach-section-heading-v2">
              <div>
                <p className="eyebrow">
                  {locale === "ru" ? "ФИЛИАЛЫ" : "FILIALlar"}
                </p>
                <h2>
                  {locale === "ru"
                    ? "Где проходят тренировки"
                    : "Mashg‘ulotlar qayerda o‘tadi"}
                </h2>
              </div>
            </div>

            <div className="coach-branch-grid-v2">
              {coach.branchLinks.map((link) => (
                <Link
                  className="coach-branch-card-v2"
                  href={`/${locale}/branches/${link.branch.slug}`}
                  key={link.branchId}
                >
                  <div>
                    <span>
                      {locale === "ru"
                        ? link.branch.districtRu || "Ташкент"
                        : link.branch.districtUz || "Toshkent"}
                    </span>
                    <h3>
                      {locale === "ru"
                        ? link.branch.publicNameRu
                        : link.branch.publicNameUz}
                    </h3>
                    <p>
                      {locale === "ru"
                        ? link.branch.addressRu
                        : link.branch.addressUz}
                    </p>
                  </div>
                  <strong>
                    {locale === "ru" ? "Открыть филиал →" : "Filialni ochish →"}
                  </strong>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="content-section">
          <div className="section-heading coach-section-heading-v2">
            <div>
              <p className="eyebrow">{locale === "ru" ? "ГРУППЫ" : "GURUHLAR"}</p>
              <h2>{locale === "ru" ? "Группы тренера" : "Murabbiy guruhlari"}</h2>
            </div>
            {coach.primaryGroups.length ? (
              <span>
                {coach.primaryGroups.length}{" "}
                {locale === "ru" ? "активных групп" : "faol guruh"}
              </span>
            ) : null}
          </div>

          {coach.primaryGroups.length ? (
            <div className="coach-group-grid-v2">
              {coach.primaryGroups.map((group) => {
                const schedule = Array.from(
                  new Set(
                    group.scheduleRules.map(
                      (rule) =>
                        `${weekdayLabel(rule.weekday, locale)} ${minutes(rule.startMinutes)}–${minutes(rule.endMinutes)}`
                    )
                  )
                );

                return (
                  <article className="coach-group-card-v2" key={group.id}>
                    <div className="coach-group-top-v2">
                      <span>
                        {group.ageMin}–{group.ageMax}{" "}
                        {locale === "ru" ? "лет" : "yosh"}
                      </span>
                      <Link href={`/${locale}/sports/${group.sport.slug}`}>
                        <strong>
                          {locale === "ru"
                            ? group.sport.nameRu
                            : group.sport.nameUz}
                        </strong>
                      </Link>
                    </div>

                    <div className="coach-schedule-v2">
                      {schedule.length ? (
                        schedule.map((item) => <span key={item}>{item}</span>)
                      ) : (
                        <span>—</span>
                      )}
                    </div>

                    <div className="coach-group-footer-v2">
                      <Link
                        href={`/${locale}/branches/${group.branch.slug}`}
                      >
                        {locale === "ru"
                          ? group.branch.publicNameRu
                          : group.branch.publicNameUz}
                      </Link>
                      {group.enrollmentStatus === EnrollmentStatus.OPEN ? (
                        <Link
                          className="coach-group-cta-v2"
                          data-analytics-event="trial_cta_click"
                          href={`/${locale}/trial?sport=${encodeURIComponent(group.sport.slug)}&branch=${encodeURIComponent(group.branch.slug)}`}
                        >
                          {locale === "ru" ? "Записаться →" : "Yozilish →"}
                        </Link>
                      ) : (
                        <span className="coach-group-cta-v2 muted">
                          {locale === "ru" ? "Набор закрыт" : "Qabul yopiq"}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="shark-coming-soon">
              {locale === "ru"
                ? "Активные группы скоро появятся."
                : "Faol guruhlar tez orada paydo bo‘ladi."}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
