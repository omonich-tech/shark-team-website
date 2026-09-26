import { MediaEditor } from "@/components/admin/media-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const prisma = getPrisma();

  const [branch, coach, sport, groups, home, items] = await Promise.all([
    prisma.branch.findUniqueOrThrow({
      where: { id: "BR-SCHOOL-117-01" }
    }),
    prisma.coach.findUniqueOrThrow({
      where: { id: "CO-0001" }
    }),
    prisma.sport.findUniqueOrThrow({
      where: { id: "SP-BASKETBALL-01" }
    }),
    prisma.trainingGroup.findMany({
      where: { branchId: "BR-SCHOOL-117-01" },
      orderBy: { ageMin: "asc" }
    }),
    prisma.contentPage.findUniqueOrThrow({
      where: { slug: "home" }
    }),
    prisma.mediaAsset.findMany({
      orderBy: [{ createdAt: "desc" }]
    })
  ]);

  const targets = [
    {
      value: branch.id,
      label: `Филиал · ${branch.publicNameRu}`,
      type: "BRANCH"
    },
    {
      value: coach.id,
      label: `Тренер · ${coach.firstName}`,
      type: "COACH"
    },
    {
      value: sport.id,
      label: `Спорт · ${sport.nameRu}`,
      type: "SPORT"
    },
    ...groups.map((group) => ({
      value: group.id,
      label: `Группа · ${group.ageMin}–${group.ageMax} лет`,
      type: "GROUP"
    })),
    {
      value: home.id,
      label: "Страница · Главная",
      type: "PAGE"
    }
  ];

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>Медиа</h1>
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
