import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public/json-ld";
import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { formatUzs, isPublicLocale } from "@/lib/public-i18n";
import { breadcrumbJsonLd, buildPublicMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublicLocale(locale)) return {};

  return buildPublicMetadata({
    locale,
    path: "/prices",
    title:
      locale === "ru"
        ? "Цены на спортивные секции SHARK TEAM"
        : "SHARK TEAM sport seksiyalari narxlari",
    description:
      locale === "ru"
        ? "Актуальные цены SHARK TEAM: пробные занятия и абонементы детских спортивных секций в Ташкенте."
        : "SHARK TEAM amaldagi narxlari: Toshkentdagi bolalar sport seksiyalari uchun sinov mashg‘ulotlari va abonementlar."
  });
}

export default async function PricesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const now = new Date();
  const prices = await prisma.price.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }]
    },
    include: {
      sport: true,
      branch: true,
      group: true
    },
    orderBy: [
      { sportId: "asc" },
      { branchId: "asc" },
      { productType: "asc" },
      { validFrom: "desc" }
    ]
  });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "SHARK TEAM", path: `/${locale}` },
          {
            name: locale === "ru" ? "Цены" : "Narxlar",
            path: `/${locale}/prices`
          }
        ])}
      />
      <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">{locale === "ru" ? "ЦЕНЫ" : "NARXLAR"}</p>
        <h1>{locale === "ru" ? "Стоимость занятий SHARK TEAM" : "SHARK TEAM mashg‘ulotlari narxi"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Актуальная стоимость занятий и пробных тренировок SHARK TEAM."
            : "SHARK TEAM mashg‘ulotlari va sinov darslarining amaldagi narxlari."}
        </p>
      </section>

      <section className="content-section">
        <div className="price-catalog-grid">
          {prices.map((price) => (
            <article className={price.productType === PriceProductType.TRIAL ? "price-card" : "price-card featured"} key={price.id}>
              <span>
                {price.productType === PriceProductType.TRIAL
                  ? locale === "ru" ? "Пробное занятие" : "Sinov mashg‘uloti"
                  : locale === "ru" ? "Абонемент" : "Abonement"}
              </span>
              <strong>{formatUzs(price.amount, locale)}</strong>
              <p>
                {price.sport
                  ? locale === "ru" ? price.sport.nameRu : price.sport.nameUz
                  : "SHARK TEAM"}
              </p>
              {price.branch ? (
                <small>{locale === "ru" ? price.branch.publicNameRu : price.branch.publicNameUz}</small>
              ) : null}
            </article>
          ))}

          {prices.length === 0 ? (
            <div className="shark-coming-soon">
              {locale === "ru" ? "Действующие цены пока не опубликованы." : "Amaldagi narxlar hali e’lon qilinmagan."}
            </div>
          ) : null}
        </div>
      </section>
      </main>
    </>
  );
}
