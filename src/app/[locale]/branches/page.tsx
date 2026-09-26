import Link from "next/link";
import { notFound } from "next/navigation";
import { LifecycleStatus } from "@/generated/prisma/client";
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
      groups: {
        some: {
          status: LifecycleStatus.ACTIVE
        }
      }
    },
    include: {
      groups: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return (
    <main className="page-main">
      <section className="page-hero compact">
        <p className="eyebrow">SHARK TEAM</p>
        <h1>{locale === "ru" ? "Филиалы" : "Filiallar"}</h1>
        <p className="lead">
          {locale === "ru"
            ? "Выберите удобный филиал и посмотрите доступные группы."
            : "Qulay filialni tanlang va mavjud guruhlarni ko‘ring."}
        </p>
      </section>

      <section className="content-section">
        <div className="branch-catalog-grid">
          {branches.map((branch) => {
            const sportNames = Array.from(
              new Set(
                branch.groups.map((group) =>
                  locale === "ru" ? group.sport.nameRu : group.sport.nameUz
                )
              )
            );

            return (
              <Link
                className="branch-catalog-card"
                href={`/${locale}/branches/${branch.slug}`}
                key={branch.id}
              >
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
              </Link>
            );
          })}

          {branches.length === 0 ? (
            <div className="coach-empty">
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
