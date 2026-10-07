import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";
import { getSportCatalogEntry } from "@/lib/sport-catalog";
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
  const sports = data?.sports ?? [];

  return (
    <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>{locale === "ru" ? "Наши виды спорта" : "Sport yo‘nalishlarimiz"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Выберите направление, возраст и удобный филиал SHARK TEAM."
            : "SHARK TEAM yo‘nalishi, yosh va qulay filialni tanlang."}
        </p>
      </section>

      <section className="content-section">
        <div className="sport-catalog-grid">
          {sports.map((sport, index) => {
            const fallback = getSportCatalogEntry(sport.slug);
            const media = data?.media.find(
              (item) =>
                item.targetType === "SPORT" &&
                item.targetId === sport.id &&
                item.contentType?.startsWith("image/")
            );
            const mark =
              fallback?.mark ?? String(index + 1).padStart(2, "0");
            const name = locale === "ru" ? sport.nameRu : sport.nameUz;
            const description =
              locale === "ru"
                ? sport.shortDescriptionRu ?? fallback?.descriptionRu ?? ""
                : sport.shortDescriptionUz ?? fallback?.descriptionUz ?? "";

            return (
              <Link
                className={
                  sport.slug === "rhythmic-gymnastics"
                    ? "sport-catalog-card sport-catalog-card-long-title"
                    : "sport-catalog-card"
                }
                href={`/${locale}/sports/${sport.slug}`}
                key={sport.id}
              >
                <div
                  className="sport-catalog-photo"
                  style={
                    media
                      ? { backgroundImage: `url("${media.url}")` }
                      : undefined
                  }
                >
                  <span>{mark}</span>
                </div>
                <div className="sport-catalog-body">
                  <h2>{name}</h2>
                  {description ? <p>{description}</p> : null}
                  {sport.ageMin !== null || sport.ageMax !== null ? (
                    <small className="sport-age-hint">
                      {locale === "ru" ? "Возраст" : "Yosh"} ·{" "}
                      {sport.ageMin ?? "—"}–{sport.ageMax ?? "—"}
                    </small>
                  ) : null}
                  <strong>
                    {sport.groups.length
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

          {sports.length === 0 ? (
            <div className="shark-coming-soon">
              <h2>
                {locale === "ru"
                  ? "Направления скоро появятся"
                  : "Yo‘nalishlar tez orada paydo bo‘ladi"}
              </h2>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
