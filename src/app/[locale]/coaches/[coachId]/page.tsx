import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

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
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      },
      branchLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { branch: true }
      },
      primaryGroups: {
        where: { status: LifecycleStatus.ACTIVE },
        include: {
          sport: true,
          branch: true,
          scheduleRules: {
            where: { status: LifecycleStatus.ACTIVE },
            orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }]
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
  const bio = locale === "ru" ? coach.publicBioRu : coach.publicBioUz;
  const education = locale === "ru" ? coach.educationRu : coach.educationUz;
  const qualification =
    locale === "ru" ? coach.qualificationRu : coach.qualificationUz;

  return (
    <main className="page-main">
      <section className="coach-detail-hero">
        <div
          className={photo ? "coach-detail-photo has-photo" : "coach-detail-photo"}
          style={photo ? { backgroundImage: `url("${photo.url}")` } : undefined}
          role={photo ? "img" : undefined}
          aria-label={
            photo
              ? (locale === "ru" ? photo.altRu : photo.altUz) ?? fullName
              : undefined
          }
        >
          {!photo ? <span>{coach.firstName.slice(0, 1)}</span> : null}
        </div>

        <div className="coach-detail-copy">
          <Link className="shark-back-link" href={`/${locale}/coaches`}>
            ← {locale === "ru" ? "Все тренеры" : "Barcha murabbiylar"}
          </Link>
          <p className="eyebrow">SHARK TEAM · {locale === "ru" ? "ТРЕНЕР" : "MURABBIY"}</p>
          <h1>{fullName}</h1>

          <div className="coach-detail-tags">
            {coach.sportLinks.map((link) => (
              <span key={link.sportId}>
                {locale === "ru" ? link.sport.nameRu : link.sport.nameUz}
              </span>
            ))}
          </div>

          {coach.experienceYears ? (
            <strong className="coach-detail-experience">
              {locale === "ru"
                ? `Опыт ${coach.experienceYears}+ лет`
                : `Tajriba ${coach.experienceYears}+ yil`}
            </strong>
          ) : null}

          {bio ? <p className="lead">{bio}</p> : null}
        </div>
      </section>

      <section className="content-section coach-detail-info-grid">
        <article>
          <p className="eyebrow">{locale === "ru" ? "ОБРАЗОВАНИЕ" : "TA’LIM"}</p>
          <h2>{locale === "ru" ? "Профессиональная база" : "Professional tayyorgarlik"}</h2>
          <p>{education || (locale === "ru" ? "Информация уточняется." : "Ma’lumot aniqlanmoqda.")}</p>
        </article>

        <article>
          <p className="eyebrow">{locale === "ru" ? "КВАЛИФИКАЦИЯ" : "MALAKA"}</p>
          <h2>{locale === "ru" ? "Компетенции тренера" : "Murabbiy kompetensiyalari"}</h2>
          <p>{qualification || (locale === "ru" ? "Информация уточняется." : "Ma’lumot aniqlanmoqda.")}</p>
        </article>

        <article>
          <p className="eyebrow">{locale === "ru" ? "ФИЛИАЛЫ" : "FILIALlar"}</p>
          <h2>{locale === "ru" ? "Где тренирует" : "Qayerda mashg‘ulot o‘tkazadi"}</h2>
          <div className="coach-detail-links">
            {coach.branchLinks.map((link) => (
              <Link
                href={`/${locale}/branches/${link.branch.slug}`}
                key={link.branchId}
              >
                {locale === "ru"
                  ? link.branch.publicNameRu
                  : link.branch.publicNameUz}
                {" →"}
              </Link>
            ))}
            {coach.branchLinks.length === 0 ? (
              <span>{locale === "ru" ? "Филиалы уточняются." : "Filiallar aniqlanmoqda."}</span>
            ) : null}
          </div>
        </article>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">{locale === "ru" ? "ГРУППЫ" : "GURUHLAR"}</p>
          <h2>{locale === "ru" ? "Текущие группы" : "Joriy guruhlar"}</h2>
        </div>

        <div className="sport-group-list">
          {coach.primaryGroups.map((group) => {
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
                    {group.ageMin}–{group.ageMax}{" "}
                    {locale === "ru" ? "лет" : "yosh"}
                  </span>
                  <h3>
                    {locale === "ru" ? group.sport.nameRu : group.sport.nameUz}
                  </h3>
                  <p>{schedule || "—"}</p>
                </div>
                <div className="sport-group-meta">
                  <span>
                    {locale === "ru"
                      ? group.branch.publicNameRu
                      : group.branch.publicNameUz}
                  </span>
                  <Link
                    className="shark-text-link"
                    href={`/${locale}/trial?sport=${encodeURIComponent(group.sport.slug)}&branch=${encodeURIComponent(group.branch.slug)}`}
                  >
                    {locale === "ru" ? "Записаться →" : "Yozilish →"}
                  </Link>
                </div>
              </article>
            );
          })}

          {coach.primaryGroups.length === 0 ? (
            <div className="shark-coming-soon">
              {locale === "ru"
                ? "Активные группы скоро появятся."
                : "Faol guruhlar tez orada paydo bo‘ladi."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
