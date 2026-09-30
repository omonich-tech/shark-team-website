import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const prisma = getPrisma();

  const [trialPayments, subscriptionPayments] = await Promise.all([
    prisma.payment.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
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
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.subscriptionPayment.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: {
        trialConversion: {
          include: {
            child: {
              include: {
                parent: true
              }
            },
            group: true
          }
        },
        enrollment: true
      }
    })
  ]);

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Оплаты</h1>
        </div>
        <span className="admin-count">
          {trialPayments.length + subscriptionPayments.length} записей
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Абонементы</h2>
          <small>Оплаты после пробного и зачисление в постоянную группу.</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Создан</th>
                <th>Статус</th>
                <th>Сумма</th>
                <th>Ребёнок</th>
                <th>Родитель</th>
                <th>Группа</th>
                <th>Период</th>
                <th>Конверсия</th>
              </tr>
            </thead>
            <tbody>
              {subscriptionPayments.map((payment) => {
                const conversion = payment.trialConversion;
                const child = conversion.child;

                return (
                  <tr key={payment.id}>
                    <td>{formatAdminDate(payment.createdAt)}</td>
                    <td>
                      <span className="admin-status">{payment.status}</span>
                    </td>
                    <td>
                      {formatAdminMoney(
                        payment.amountUzs,
                        payment.currency
                      )}
                    </td>
                    <td>{child.name}</td>
                    <td>
                      {child.parent.name}
                      <br />
                      {child.parent.phone}
                    </td>
                    <td>{conversion.group.internalName}</td>
                    <td>
                      {payment.periodStart && payment.periodEnd
                        ? formatAdminDate(payment.periodStart) +
                          " → " +
                          formatAdminDate(payment.periodEnd)
                        : "—"}
                      <br />
                      <small>№{payment.sequence}</small>
                    </td>
                    <td>{conversion.status}</td>
                  </tr>
                );
              })}
              {subscriptionPayments.length === 0 ? (
                <tr>
                  <td colSpan={8}>Оплат абонементов пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Пробные занятия</h2>
        </div>
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
              {trialPayments.map((payment) => {
                const lead = payment.trialBooking.lead;
                const transaction = payment.paymeTransactions[0];

                return (
                  <tr key={payment.id}>
                    <td>{formatAdminDate(payment.createdAt)}</td>
                    <td>
                      <span className="admin-status">{payment.status}</span>
                    </td>
                    <td>
                      {formatAdminMoney(
                        payment.amountUzs,
                        payment.currency
                      )}
                    </td>
                    <td>{lead.childName}</td>
                    <td>
                      {lead.parentName}
                      <br />
                      {lead.phone}
                    </td>
                    <td>
                      {formatAdminDate(
                        payment.trialBooking.session.startsAt
                      )}
                    </td>
                    <td>{transaction ? transaction.state : "—"}</td>
                  </tr>
                );
              })}
              {trialPayments.length === 0 ? (
                <tr>
                  <td colSpan={7}>Оплат пробных пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
