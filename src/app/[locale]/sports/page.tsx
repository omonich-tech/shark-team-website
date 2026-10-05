import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";
import { SPORT_CATALOG } from "@/lib/sport-catalog";
import { tryGetPublicHomeData } from "@/server/public-data/home";

export const dynamic = "force-dynamic";

export default async function SportsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const data = await tryGetPublicHomeData();

  return (
    <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>{locale === "ru" ? "Наши виды спорта" : "Sport yo‘nalishlarimiz"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Пять направлений — одна философия: помочь ребёнку стать сильнее физически, увереннее и дисциплинированнее."
            : "Besh yo‘nalish — bitta falsafa: bolaga jismonan kuchliroq, ishonchliroq va intizomliroq bo‘lishga yordam berish."}
        </p>
      </section>

      <section className="content-section">
        <div className="sport-catalog-grid">
          {SPORT_CATALOG.map((entry) => {
            const sport = data?.sports.find((item) => item.slug === entry.slug);
            const media = sport
              ? data?.media.find(
                  (item) =>
                    item.targetType === "SPORT" &&
                    item.targetId === sport.id &&
                    item.contentType?.startsWith("image/")
                )
              : null;

            return (
              <Link
                className={
                  entry.slug === "rhythmic-gymnastics"
                    ? "sport-catalog-card sport-catalog-card-long-title"
                    : "sport-catalog-card"
                }
                href={`/${locale}/sports/${entry.slug}`}
                key={entry.slug}
              >
                <div
                  className="sport-catalog-photo"
                  style={
                    media
                      ? { backgroundImage: `url("${media.url}")` }
                      : undefined
                  }
                >
                  <span>{entry.mark}</span>
                </div>
                <div className="sport-catalog-body">
                  <h2>{locale === "ru" ? entry.nameRu : entry.nameUz}</h2>
                  <p>
                    {locale === "ru"
                      ? sport?.shortDescriptionRu ?? entry.descriptionRu
                      : sport?.shortDescriptionUz ?? entry.descriptionUz}
                  </p>
                  <strong>
                    {sport?.groups.length
                      ? locale === "ru"
                        ? "Есть активные группы →"
                        : "Faol guruhlar bor →"
                      : locale === "ru"
                        ? "Подробнее →"
                        : "Batafsil →"}
                  </strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
