import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollmentStatus, LifecycleStatus } from "@/generated/prisma/client";
import { JsonLd } from "@/components/public/json-ld";
import { getPrisma } from "@/lib/prisma";
import { PUBLIC_GROUP_WHERE } from "@/server/public-data/visibility";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";
import { breadcrumbJsonLd, buildPublicMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublicLocale(locale)) return {};

  return buildPublicMetadata({
    locale,
    path: "/schedule",
    title:
      locale === "ru"
        ? "Расписание спортивных секций SHARK TEAM"
        : "SHARK TEAM sport seksiyalari jadvali",
    description:
      locale === "ru"
        ? "Актуальное расписание детских спортивных групп SHARK TEAM в Ташкенте: виды спорта, филиалы, возраст и тренеры."
        : "Toshkentdagi SHARK TEAM bolalar sport guruhlarining amaldagi jadvali: sport turlari, filiallar, yosh va murabbiylar."
  });
}

function time(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export default async function SchedulePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const groups = await prisma.trainingGroup.findMany({
    where: PUBLIC_GROUP_WHERE,
    include: {
      sport: true,
      branch: true,
      primaryCoach: true,
      scheduleRules: {
        where: { status: LifecycleStatus.ACTIVE }
      }
    },
    orderBy: [{ sportId: "asc" }, { branchId: "asc" }, { ageMin: "asc" }]
  });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "SHARK TEAM", path: `/${locale}` },
          {
            name: locale === "ru" ? "Расписание" : "Jadval",
            path: `/${locale}/schedule`
          }
        ])}
      />
      <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">{locale === "ru" ? "РАСПИСАНИЕ" : "JADVAL"}</p>
        <h1>{locale === "ru" ? "Все активные группы" : "Barcha faol guruhlar"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Актуальное расписание всех видов спорта и филиалов SHARK TEAM."
            : "SHARK TEAM barcha sport turlari va filiallarining amaldagi jadvali."}
        </p>
      </section>

      <section className="content-section">
        <div className="sport-group-list">
          {groups.map((group) => (
            <article className="sport-group-row" key={group.id}>
              <div>
                <span>
                  <Link href={`/${locale}/sports/${group.sport.slug}`}>
                    {locale === "ru" ? group.sport.nameRu : group.sport.nameUz}
                  </Link>{" "}
                  · {group.ageMin}–{group.ageMax} {locale === "ru" ? "лет" : "yosh"}
                </span>
                <h3>
                  <Link href={`/${locale}/branches/${group.branch.slug}`}>
                    {locale === "ru" ? group.branch.publicNameRu : group.branch.publicNameUz}
                  </Link>
                </h3>
                <p>
                  {group.scheduleRules
                    .map((rule) => `${weekdayLabel(rule.weekday, locale)} ${time(rule.startMinutes)}–${time(rule.endMinutes)}`)
                    .join(" · ")}
                </p>
              </div>
              <div className="sport-group-meta">
                <Link href={`/${locale}/coaches/${group.primaryCoach.id}`}>
                  {[group.primaryCoach.firstName, group.primaryCoach.lastName].filter(Boolean).join(" ")}
                </Link>
                {group.enrollmentStatus === EnrollmentStatus.OPEN ? (
                  <Link
                    className="shark-text-link"
                    data-analytics-event="trial_cta_click"
                    href={`/${locale}/trial?sport=${encodeURIComponent(group.sport.slug)}&branch=${encodeURIComponent(group.branch.slug)}`}
                  >
                    {locale === "ru" ? "Пробное →" : "Sinov →"}
                  </Link>
                ) : (
                  <span className="schedule-enrollment-status">
                    {locale === "ru" ? "Набор закрыт" : "Qabul yopiq"}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      </main>
    </>
  );
}
