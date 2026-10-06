import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { PriceEditor } from "@/components/admin/price-editor";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  branchId?: string | string[];
  sportId?: string | string[];
}>;

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function AdminPricesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const prisma = getPrisma();
  const now = new Date();
  const params = await searchParams;

  const [branches, sports] = await Promise.all([
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const requestedBranchId = singleParam(params.branchId);
  const requestedSportId = singleParam(params.sportId);

  const selectedBranch =
    branches.find((branch) => branch.id === requestedBranchId) ?? branches[0] ?? null;
  const selectedSport =
    sports.find((sport) => sport.id === requestedSportId) ?? sports[0] ?? null;

  const prices =
    selectedBranch && selectedSport
      ? await prisma.price.findMany({
          where: {
            branchId: selectedBranch.id,
            sportId: selectedSport.id,
            status: LifecycleStatus.ACTIVE
          },
          orderBy: {
            validFrom: "desc"
          }
        })
      : [];

  const currentTrial = prices.find(
    (price) =>
      price.productType === PriceProductType.TRIAL &&
      price.validFrom <= now &&
      (!price.validTo || price.validTo > now)
  );

  const currentSubscription = prices.find(
    (price) =>
      price.productType === PriceProductType.SUBSCRIPTION &&
      price.validFrom <= now &&
      (!price.validTo || price.validTo > now)
  );

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Цены</h1>
        </div>
        <span className="admin-count">Версионируются по дате</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Объект цены</h2>
            <small>Выберите филиал и вид спорта, для которых действует цена.</small>
          </div>
        </div>

        <form className="admin-editor" method="get">
          <div className="admin-editor-grid">
            <label className="admin-field">
              <span>Филиал</span>
              <select
                name="branchId"
                defaultValue={selectedBranch?.id ?? ""}
                disabled={branches.length === 0}
              >
                {branches.map((branch) => (
                  <option value={branch.id} key={branch.id}>
                    {branch.publicNameRu}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-field">
              <span>Вид спорта</span>
              <select
                name="sportId"
                defaultValue={selectedSport?.id ?? ""}
                disabled={sports.length === 0}
              >
                {sports.map((sport) => (
                  <option value={sport.id} key={sport.id}>
                    {sport.nameRu}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-editor-actions">
            <button
              className="button secondary"
              type="submit"
              disabled={!selectedBranch || !selectedSport}
            >
              Показать цены
            </button>
          </div>
        </form>
      </section>

      {selectedBranch && selectedSport ? (
        <>
          <section className="admin-panel admin-editor-panel">
            <div className="admin-panel-head">
              <div>
                <h2>
                  {selectedBranch.publicNameRu} · {selectedSport.nameRu}
                </h2>
                <small>
                  Изменение создаёт новую версию цены. Предыдущая остаётся в истории.
                </small>
              </div>
            </div>

            <PriceEditor
              branchId={selectedBranch.id}
              sportId={selectedSport.id}
              trialAmount={currentTrial?.amount ?? null}
              subscriptionAmount={currentSubscription?.amount ?? null}
            />
          </section>

          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>История цен</h2>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th>Цена</th>
                    <th>С</th>
                    <th>До</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((price) => (
                    <tr key={price.id}>
                      <td>{price.productType}</td>
                      <td>{formatAdminMoney(price.amount, price.currency)}</td>
                      <td>{formatAdminDate(price.validFrom)}</td>
                      <td>{formatAdminDate(price.validTo)}</td>
                    </tr>
                  ))}
                  {prices.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        Для этой пары филиал / вид спорта цены ещё не заданы.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="admin-panel">
          Сначала создайте хотя бы один филиал и один вид спорта.
        </section>
      )}
    </>
  );
}
