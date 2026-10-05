import { notFound } from "next/navigation";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale, weekdayLabel } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

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
    where: { status: LifecycleStatus.ACTIVE },
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
                  {locale === "ru" ? group.sport.nameRu : group.sport.nameUz} ·{" "}
                  {group.ageMin}–{group.ageMax} {locale === "ru" ? "лет" : "yosh"}
                </span>
                <h3>{locale === "ru" ? group.branch.publicNameRu : group.branch.publicNameUz}</h3>
                <p>
                  {group.scheduleRules
                    .map((rule) => `${weekdayLabel(rule.weekday, locale)} ${time(rule.startMinutes)}`)
                    .join(" · ")}
                </p>
              </div>
              <div className="sport-group-meta">
                <span>{[group.primaryCoach.firstName, group.primaryCoach.lastName].filter(Boolean).join(" ")}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
