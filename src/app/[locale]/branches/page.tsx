import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LifecycleStatus,
  MediaConsentStatus,
  MediaTargetType
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export default async function BranchCatalogPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const prisma = getPrisma();
  const branches = await prisma.branch.findMany({
    where: {
      status: LifecycleStatus.ACTIVE,
      groups: { some: { status: LifecycleStatus.ACTIVE } }
    },
    include: {
      groups: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const media = branches.length
    ? await prisma.mediaAsset.findMany({
        where: {
          targetType: MediaTargetType.BRANCH,
          targetId: { in: branches.map((branch) => branch.id) },
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

  return (
    <main className="page-main">
      <section className="page-hero compact shark-page-hero">
        <p className="eyebrow">SHARK TEAM · TASHKENT</p>
        <h1>{locale === "ru" ? "Наши филиалы" : "Filiallarimiz"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Выберите удобную локацию. В карточке филиала вы увидите направления, группы, тренеров и расписание."
            : "Qulay manzilni tanlang. Filial sahifasida yo‘nalishlar, guruhlar, murabbiylar va jadvalni ko‘rasiz."}
        </p>
      </section>

      <section className="content-section">
        <div className="branch-catalog-grid shark-branch-catalog-grid">
          {branches.map((branch) => {
            const sportNames = Array.from(
              new Set(
                branch.groups.map((group) =>
                  locale === "ru" ? group.sport.nameRu : group.sport.nameUz
                )
              )
            );
            const photo = media.find(
              (item) =>
                item.targetId === branch.id &&
                item.contentType?.startsWith("image/")
            );

            return (
              <Link
                className="branch-catalog-card shark-branch-catalog-card"
                href={`/${locale}/branches/${branch.slug}`}
                key={branch.id}
              >
                <div
                  className="branch-catalog-photo"
                  style={
                    photo
                      ? { backgroundImage: `url("${photo.url}")` }
                      : undefined
                  }
                />
                <div className="branch-catalog-content">
                  <span className="eyebrow">
                    {locale === "ru" ? branch.districtRu : branch.districtUz}
                  </span>
                  <h2>
                    {locale === "ru"
                      ? branch.publicNameRu
                      : branch.publicNameUz}
                  </h2>
                  <p>{locale === "ru" ? branch.addressRu : branch.addressUz}</p>
                  <small>{sportNames.join(" · ")}</small>
                  <strong>
                    {locale === "ru" ? "Открыть филиал →" : "Filialni ochish →"}
                  </strong>
                </div>
              </Link>
            );
          })}

          {branches.length === 0 ? (
            <div className="shark-coming-soon">
              {locale === "ru"
                ? "Активных филиалов пока нет."
                : "Faol filiallar hozircha yo‘q."}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
