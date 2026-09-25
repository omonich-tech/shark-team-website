import { notFound } from "next/navigation";
import { DataUnavailable } from "@/components/public/public-shell";
import { CoachCard } from "@/components/public/school117-blocks";
import { isPublicLocale } from "@/lib/public-i18n";
import { tryGetSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export default async function CoachesPage({
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
        <p className="eyebrow">{locale === "ru" ? "ТРЕНЕРЫ" : "MURABBIYLAR"}</p>
        <h1>{locale === "ru" ? "Тренер SHARK TEAM" : "SHARK TEAM murabbiyi"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Публично показываем только подтверждённые данные. Биография и фотографии будут добавляться через админку позже."
            : "Ochiq sahifada faqat tasdiqlangan ma’lumotlar ko‘rsatiladi. Biografiya va suratlar keyin admin panel orqali qo‘shiladi."}
        </p>
      </section>

      <section className="content-section">
        <CoachCard data={data} locale={locale} />
      </section>
    </main>
  );
}
