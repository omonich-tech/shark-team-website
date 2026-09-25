import Link from "next/link";
import { notFound } from "next/navigation";
import { DataUnavailable } from "@/components/public/public-shell";
import {
  CoachCard,
  GroupGrid,
  PriceCards
} from "@/components/public/school117-blocks";
import { isPublicLocale } from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function BasketballPage({
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
          eyebrow: "БАСКЕТБОЛ · SHARK TEAM",
          title: "Баскетбольная секция для детей",
          lead: "Тренировки проходят в действующих возрастных группах. На старте SHARK TEAM работает один реальный баскетбольный филиал — школа №117.",
          groups: "Возрастные группы",
          coach: "Тренер",
          prices: "Стоимость",
          branch: "Посмотреть филиал"
        }
      : {
          eyebrow: "BASKETBOL · SHARK TEAM",
          title: "Bolalar uchun basketbol seksiyasi",
          lead: "Mashg‘ulotlar amaldagi yosh guruhlarida o‘tkaziladi. Hozir SHARK TEAM’ning real basketbol filiali — 117-maktab.",
          groups: "Yosh guruhlari",
          coach: "Murabbiy",
          prices: "Narxlar",
          branch: "Filialni ko‘rish"
        };

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.lead}</p>
        <Link className="button primary" href={`/${locale}/branches/school-117`}>
          {copy.branch}
        </Link>
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
