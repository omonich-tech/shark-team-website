import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const prisma = getPrisma();

  const payments = await prisma.payment.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      trialBooking: {
        include: {
          lead: true,
          session: {
            include: {
              group: true
            }
          }
        }
      },
      paymeTransactions: {
        orderBy: {
          createdAt: "desc"
        },
        take: 1
      }
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Оплаты</h1>
        </div>
        <span className="admin-count">{payments.length} записей</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Создан</th>
                <th>Статус</th>
                <th>Сумма</th>
                <th>Ребёнок</th>
                <th>Родитель</th>
                <th>Пробное</th>
                <th>Payme state</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const lead = payment.trialBooking.lead;
                const transaction = payment.paymeTransactions[0];

                return (
                  <tr key={payment.id}>
                    <td>{formatAdminDate(payment.createdAt)}</td>
                    <td><span className="admin-status">{payment.status}</span></td>
                    <td>{formatAdminMoney(payment.amountUzs, payment.currency)}</td>
                    <td>{lead.childName}</td>
                    <td>{lead.parentName}<br />{lead.phone}</td>
                    <td>{formatAdminDate(payment.trialBooking.session.startsAt)}</td>
                    <td>{transaction ? transaction.state : "—"}</td>
                  </tr>
                );
              })}
              {payments.length === 0 ? (
                <tr><td colSpan={7}>Оплат пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
