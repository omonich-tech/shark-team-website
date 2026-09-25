import { notFound } from "next/navigation";
import { DataUnavailable } from "@/components/public/public-shell";
import {
  CoachCard,
  GroupGrid,
  LocationCard,
  PriceCards
} from "@/components/public/school117-blocks";
import {
  isPublicLocale,
  pickLocalized
} from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function School117Page({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  const data = await tryGetSchool117PublicData();

  if (!data) {
    return <DataUnavailable locale={locale} />;
  }

  const copy =
    locale === "ru"
      ? {
          eyebrow: "ЮНУСАБАД · ТАШКЕНТ",
          lead: "Баскетбольный филиал SHARK TEAM в спортивном зале школы №117.",
          location: "Адрес и ориентир",
          groups: "Группы",
          coach: "Тренер",
          prices: "Стоимость"
        }
      : {
          eyebrow: "YUNUSOBOD · TOSHKENT",
          lead: "117-maktab sport zalidagi SHARK TEAM basketbol filiali.",
          location: "Manzil va mo‘ljal",
          groups: "Guruhlar",
          coach: "Murabbiy",
          prices: "Narxlar"
        };

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{pickLocalized(locale, data.name)}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>{copy.location}</h2>
        </div>
        <LocationCard data={data} locale={locale} />
      </section>

      <section className="content-section">
        <div className="section-heading">
          <h2>{copy.groups}</h2>
        </div>
        <GroupGrid data={data} locale={locale} />
      </section>

      <section className="split-section">
        <div>
          <div className="section-heading">
            <h2>{copy.coach}</h2>
          </div>
          <CoachCard data={data} locale={locale} />
        </div>
        <div>
          <div className="section-heading">
            <h2>{copy.prices}</h2>
          </div>
          <PriceCards data={data} locale={locale} />
        </div>
      </section>
    </main>
  );
}
