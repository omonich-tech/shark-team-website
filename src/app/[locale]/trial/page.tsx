import { notFound } from "next/navigation";
import { TrialLeadFlow } from "@/components/public/trial-lead-flow";
import { isPublicLocale } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export default async function TrialPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">
          {locale === "ru" ? "ПРОБНОЕ ЗАНЯТИЕ" : "SINOV MASHG‘ULOTI"}
        </p>
        <h1>
          {locale === "ru"
            ? "Подберите группу и дату пробного"
            : "Guruh va sinov sanasini tanlang"}
        </h1>
        <p className="lead">
          {locale === "ru"
            ? "Система подберёт группу по возрасту и покажет только доступные будущие тренировки."
            : "Tizim yoshga mos guruhni tanlaydi va faqat mavjud kelgusi mashg‘ulotlarni ko‘rsatadi."}
        </p>
      </section>

      <section className="content-section booking-section">
        <TrialLeadFlow locale={locale} />
      </section>
    </main>
  );
}
