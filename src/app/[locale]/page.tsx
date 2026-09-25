import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CoachCard,
  GroupGrid,
  LocationCard,
  PriceCards
} from "@/components/public/school117-blocks";
import { DataUnavailable } from "@/components/public/public-shell";
import {
  isPublicLocale,
  pickLocalized
} from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function PublicHome({
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
          eyebrow: "SHARK TEAM · ТАШКЕНТ",
          title: "Баскетбол для детей в Ташкенте",
          lead: "Три возрастные группы, понятное расписание и платное пробное занятие в действующей группе.",
          groups: "Группы и расписание",
          location: "Первый филиал SHARK TEAM",
          prices: "Стоимость",
          coach: "Тренер",
          details: "Подробнее о филиале",
          schedule: "Открыть расписание",
          trial: "Записаться на пробное"
        }
      : {
          eyebrow: "SHARK TEAM · TOSHKENT",
          title: "Toshkentda bolalar uchun basketbol",
          lead: "Uchta yosh guruhi, aniq jadval va amaldagi guruhda pullik sinov mashg‘uloti.",
          groups: "Guruhlar va jadval",
          location: "SHARK TEAM birinchi filiali",
          prices: "Narxlar",
          coach: "Murabbiy",
          details: "Filial haqida batafsil",
          schedule: "Jadvalni ochish",
          trial: "Sinovga yozilish"
        };

  return (
    <main className="page-main">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <div className="hero-actions">
            <Link className="button primary" href={`/${locale}/trial`}>
              {copy.trial}
            </Link>
            <Link
              className="button secondary"
              href={`/${locale}/branches/school-117`}
            >
              {copy.details}
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <span>{locale === "ru" ? "Филиал" : "Filial"}</span>
          <strong>{pickLocalized(locale, data.name)}</strong>
          <p>{pickLocalized(locale, data.landmark)}</p>
        </div>
      </section>

      <section className="content-section" id="groups">
        <div className="section-heading">
          <p className="eyebrow">{locale === "ru" ? "БАСКЕТБОЛ" : "BASKETBOL"}</p>
          <h2>{copy.groups}</h2>
        </div>
        <GroupGrid data={data} locale={locale} />
      </section>

      <section className="split-section">
        <div>
          <div className="section-heading">
            <p className="eyebrow">{locale === "ru" ? "ЛОКАЦИЯ" : "MANZIL"}</p>
            <h2>{copy.location}</h2>
          </div>
          <LocationCard data={data} locale={locale} />
        </div>
        <div>
          <div className="section-heading">
            <p className="eyebrow">{locale === "ru" ? "КОМАНДА" : "JAMOA"}</p>
            <h2>{copy.coach}</h2>
          </div>
          <CoachCard data={data} locale={locale} />
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">{locale === "ru" ? "ОПЛАТА" : "TO‘LOV"}</p>
          <h2>{copy.prices}</h2>
        </div>
        <PriceCards data={data} locale={locale} />
      </section>
    </main>
  );
}
