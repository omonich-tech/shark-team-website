import { notFound } from "next/navigation";
import { DataUnavailable } from "@/components/public/public-shell";
import { PriceCards } from "@/components/public/school117-blocks";
import { isPublicLocale } from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function PricesPage({
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

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">{locale === "ru" ? "ЦЕНЫ" : "NARXLAR"}</p>
        <h1>
          {locale === "ru"
            ? "Стоимость занятий SHARK TEAM"
            : "SHARK TEAM mashg‘ulotlari narxi"}
        </h1>
        <p className="lead">
          {locale === "ru"
            ? "Цены на странице берутся из действующих записей Price в базе данных."
            : "Sahifadagi narxlar bazadagi amaldagi Price yozuvlaridan olinadi."}
        </p>
      </section>

      <section className="content-section">
        <PriceCards data={data} locale={locale} />
      </section>
    </main>
  );
}
