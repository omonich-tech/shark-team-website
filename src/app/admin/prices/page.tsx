import {
  LifecycleStatus,
  PriceProductType
} from "@/generated/prisma/client";
import { PriceEditor } from "@/components/admin/price-editor";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  const prisma = getPrisma();
  const now = new Date();

  const prices = await prisma.price.findMany({
    where: {
      branchId: "BR-SCHOOL-117-01",
      sportId: "SP-BASKETBALL-01",
      status: LifecycleStatus.ACTIVE
    },
    orderBy: {
      validFrom: "desc"
    }
  });

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
        <PriceEditor
          branchId="BR-SCHOOL-117-01"
          sportId="SP-BASKETBALL-01"
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
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
