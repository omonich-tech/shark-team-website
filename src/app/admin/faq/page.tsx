import { FaqEditor } from "@/components/admin/faq-editor";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  branchId?: string | string[];
  sportId?: string | string[];
}>;

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminFaqPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedBranchId = single(params.branchId);
  const selectedSportId = single(params.sportId);
  const prisma = getPrisma();

  const [items, branches, sports] = await Promise.all([
    prisma.faqItem.findMany({
      where: {
        branchId: selectedBranchId || null,
        sportId: selectedSportId || null
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      select: { id: true, publicNameRu: true },
      orderBy: { publicNameRu: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      select: { id: true, nameRu: true },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    })
  ]);

  const branchName =
    branches.find((branch) => branch.id === selectedBranchId)?.publicNameRu ??
    null;
  const sportName =
    sports.find((sport) => sport.id === selectedSportId)?.nameRu ?? null;

  const scopeLabel =
    branchName && sportName
      ? branchName + " · " + sportName
      : branchName
        ? "Филиал: " + branchName
        : sportName
          ? "Спорт: " + sportName
          : "Глобальный FAQ";

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>FAQ</h1>
          <p className="admin-page-note">
            Глобальные вопросы показываются на главной. Scoped FAQ используется
            на страницах конкретных видов спорта и филиалов.
          </p>
        </div>
        <span className="admin-count">{items.length} вопросов</span>
      </div>

      <section className="admin-panel analytics-filter-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Контекст</p>
            <h2>Для кого этот FAQ</h2>
          </div>
          <span className="admin-count-pill">{scopeLabel}</span>
        </div>

        <form className="faq-scope-form" method="get">
          <label className="admin-field">
            <span>Филиал</span>
            <select name="branchId" defaultValue={selectedBranchId}>
              <option value="">Все филиалы / глобально</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.publicNameRu}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field">
            <span>Вид спорта</span>
            <select name="sportId" defaultValue={selectedSportId}>
              <option value="">Все виды / глобально</option>
              {sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.nameRu}
                </option>
              ))}
            </select>
          </label>

          <button className="button primary" type="submit">
            Показать FAQ
          </button>
        </form>
      </section>

      <FaqEditor
        branchId={selectedBranchId || null}
        sportId={selectedSportId || null}
        scopeLabel={scopeLabel}
        initialItems={items.map((item) => ({
          id: item.id,
          status: item.status,
          questionRu: item.questionRu,
          questionUz: item.questionUz,
          answerRu: item.answerRu,
          answerUz: item.answerUz,
          sortOrder: item.sortOrder
        }))}
      />
    </>
  );
}
