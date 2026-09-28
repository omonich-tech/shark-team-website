import { notFound } from "next/navigation";
import {
  CoachCard,
  GroupGrid,
  LocationCard,
  PriceCards,
  PublicMediaGallery
} from "@/components/public/school117-blocks";
import { DataUnavailable } from "@/components/public/public-shell";
import { isPublicLocale, pickLocalized } from "@/lib/public-i18n";
import { tryGetBranchPublicData } from "@/server/public-data/branch";

export const dynamic = "force-dynamic";

export default async function PublicBranchPage({
  params
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isPublicLocale(locale)) notFound();

  const data = await tryGetBranchPublicData(slug);

  if (!data) {
    return <DataUnavailable locale={locale} />;
  }

  const copy =
    locale === "ru"
      ? {
          eyebrow: "SHARK TEAM · ТАШКЕНТ",
          lead: "Спортивный филиал SHARK TEAM.",
          location: "Адрес и ориентир",
          groups: "Группы",
          coach: "Тренер",
          prices: "Стоимость",
          media: "Фото и видео"
        }
      : {
          eyebrow: "SHARK TEAM · TOSHKENT",
          lead: "SHARK TEAM sport filiali.",
          location: "Manzil va mo‘ljal",
          groups: "Guruhlar",
          coach: "Murabbiy",
          prices: "Narxlar",
          media: "Foto va video"
        };

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{pickLocalized(locale, data.name)}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="content-section">
        <div className="section-heading"><h2>{copy.location}</h2></div>
        <LocationCard data={data} locale={locale} />
      </section>

      <section className="content-section">
        <div className="section-heading"><h2>{copy.groups}</h2></div>
        <GroupGrid data={data} locale={locale} />
      </section>

      <section className="split-section">
        <div>
          <div className="section-heading"><h2>{copy.coach}</h2></div>
          <CoachCard data={data} locale={locale} />
        </div>
        <div>
          <div className="section-heading"><h2>{copy.prices}</h2></div>
          <PriceCards data={data} locale={locale} />
        </div>
      </section>

      {data.media.length > 0 ? (
        <section className="content-section">
          <div className="section-heading"><h2>{copy.media}</h2></div>
          <PublicMediaGallery data={data} locale={locale} />
        </section>
      ) : null}
    </main>
  );
}
