import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/public/json-ld";
import { notFound } from "next/navigation";
import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale } from "@/lib/public-i18n";
import { absoluteUrl, breadcrumbJsonLd, buildPublicMetadata } from "@/lib/seo";

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
    path: "/coaches",
    title:
      locale === "ru"
        ? "Тренеры SHARK TEAM"
        : "SHARK TEAM murabbiylari",
    description:
      locale === "ru"
        ? "Тренеры детских спортивных секций SHARK TEAM в Ташкенте: опыт, направления, филиалы и активные группы."
        : "Toshkentdagi SHARK TEAM bolalar sport seksiyalari murabbiylari: tajriba, yo‘nalishlar, filiallar va guruhlar."
  });
}

export default async function CoachesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const coaches = await prisma.coach.findMany({
    where: { status: LifecycleStatus.ACTIVE },
    include: {
      sportLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      },
      branchLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { branch: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const media = coaches.length
    ? await prisma.mediaAsset.findMany({
        where: {
          targetType: MediaTargetType.COACH,
          targetId: { in: coaches.map((coach) => coach.id) },
          OR: [
            { containsMinors: false },
            {
              containsMinors: true,
              consentStatus: MediaConsentStatus.APPROVED
            }
          ]
        },
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
          { createdAt: "asc" }
        ]
      })
    : [];

  const structuredData = [
    breadcrumbJsonLd([
      { name: "SHARK TEAM", path: `/${locale}` },
      {
        name: locale === "ru" ? "Тренеры" : "Murabbiylar",
        path: `/${locale}/coaches`
      }
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: coaches.map((coach, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: [coach.firstName, coach.lastName].filter(Boolean).join(" "),
        url: absoluteUrl(`/${locale}/coaches/${coach.id}`)
      }))
    }
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">{locale === "ru" ? "КОМАНДА" : "JAMOA"}</p>
        <h1>{locale === "ru" ? "Тренеры SHARK TEAM" : "SHARK TEAM murabbiylari"}</h1>
      </section>

      <section className="content-section">
        <div className="coach-catalog-grid">
          {coaches.map((coach) => {
            const photo = media.find(
              (item) =>
                item.targetId === coach.id &&
                item.contentType?.startsWith("image/")
            );
            const sports = coach.sportLinks
              .map((link) =>
                locale === "ru" ? link.sport.nameRu : link.sport.nameUz
              )
              .join(" · ");
            const branches = coach.branchLinks
              .map((link) =>
                locale === "ru"
                  ? link.branch.publicNameRu
                  : link.branch.publicNameUz
              )
              .join(" · ");
            const bio =
              locale === "ru" ? coach.publicBioRu : coach.publicBioUz;

            return (
              <Link
                className="coach-profile-card coach-profile-card-link"
                href={`/${locale}/coaches/${coach.id}`}
                key={coach.id}
              >
                <div
                  className="coach-profile-photo"
                  style={
                    photo
                      ? { backgroundImage: `url("${photo.url}")` }
                      : undefined
                  }
                >
                  {!photo ? <span>{coach.firstName.slice(0, 1)}</span> : null}
                </div>
                <div className="coach-profile-body">
                  <p className="eyebrow">{sports || "SHARK TEAM"}</p>
                  <h2>
                    {[coach.firstName, coach.lastName].filter(Boolean).join(" ")}
                  </h2>
                  {coach.experienceYears ? (
                    <strong>
                      {locale === "ru"
                        ? `Опыт ${coach.experienceYears}+ лет`
                        : `Tajriba ${coach.experienceYears}+ yil`}
                    </strong>
                  ) : null}
                  {bio ? <p>{bio}</p> : null}
                  {branches ? <small>{branches}</small> : null}
                </div>
              </Link>
            );
          })}

          {coaches.length === 0 ? (
            <div className="shark-coming-soon">
              {locale === "ru"
                ? "Информация о тренерах скоро появится."
                : "Murabbiylar haqida ma’lumot tez orada paydo bo‘ladi."}
            </div>
          ) : null}
        </div>
      </section>
      </main>
    </>
  );
}
