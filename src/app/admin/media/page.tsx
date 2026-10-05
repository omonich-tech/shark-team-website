import { MediaEditor } from "@/components/admin/media-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const prisma = getPrisma();

  const [branches, coaches, sports, groups, pages, items] = await Promise.all([
    prisma.branch.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.coach.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.sport.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.trainingGroup.findMany({
      include: { branch: true, sport: true },
      orderBy: [{ branchId: "asc" }, { ageMin: "asc" }]
    }),
    prisma.contentPage.findMany({
      where: { slug: { in: ["brand", "home", "about", "contacts"] } },
      orderBy: { slug: "asc" }
    }),
    prisma.mediaAsset.findMany({
      orderBy: [{ createdAt: "desc" }]
    })
  ]);

  const pageLabels: Record<string, string> = {
    brand: "Бренд · Логотип",
    home: "Главная",
    about: "О нас",
    contacts: "Контакты"
  };

  const targets = [
    ...pages.map((page) => ({
      value: page.id,
      label: `Страница · ${pageLabels[page.slug] ?? page.slug}`,
      type: "PAGE"
    })),
    ...sports.map((sport) => ({
      value: sport.id,
      label: `Спорт · ${sport.nameRu}`,
      type: "SPORT"
    })),
    ...branches.map((branch) => ({
      value: branch.id,
      label: `Филиал · ${branch.publicNameRu}`,
      type: "BRANCH"
    })),
    ...coaches.map((coach) => ({
      value: coach.id,
      label: `Тренер · ${[coach.firstName, coach.lastName].filter(Boolean).join(" ")}`,
      type: "COACH"
    })),
    ...groups.map((group) => ({
      value: group.id,
      label: `Группа · ${group.sport.nameRu} · ${group.branch.publicNameRu} · ${group.ageMin}–${group.ageMax}`,
      type: "GROUP"
    }))
  ];

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>Медиа</h1>
          <p className="admin-page-note">
            Единая медиатека для страниц сайта, видов спорта, филиалов, тренеров и групп.
          </p>
        </div>
        <span className="admin-count">{items.length} файлов</span>
      </div>

      <MediaEditor
        targets={targets}
        initialItems={items.map((item) => ({
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
          category: item.category,
          url: item.url,
          contentType: item.contentType,
          size: item.size,
          isPrimary: item.isPrimary,
          altRu: item.altRu,
          altUz: item.altUz,
          containsMinors: item.containsMinors,
          consentStatus: item.consentStatus,
          sortOrder: item.sortOrder
        }))}
      />
    </>
  );
}
