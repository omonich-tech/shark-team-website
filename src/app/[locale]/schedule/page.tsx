import { notFound } from "next/navigation";
import { DataUnavailable } from "@/components/public/public-shell";
import { GroupGrid } from "@/components/public/school117-blocks";
import { isPublicLocale } from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
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
        <p className="eyebrow">{locale === "ru" ? "РАСПИСАНИЕ" : "JADVAL"}</p>
        <h1>
          {locale === "ru"
            ? "Расписание баскетбольных групп"
            : "Basketbol guruhlari jadvali"}
        </h1>
        <p className="lead">
          {locale === "ru"
            ? "Актуальное регулярное расписание берётся напрямую из базы SHARK TEAM."
            : "Amaldagi muntazam jadval bevosita SHARK TEAM bazasidan olinadi."}
        </p>
      </section>

      <section className="content-section">
        <GroupGrid data={data} locale={locale} />
      </section>
    </main>
  );
}
