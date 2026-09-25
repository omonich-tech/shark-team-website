import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTrialsPage() {
  const prisma = getPrisma();

  const trials = await prisma.trialBooking.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      lead: true,
      payment: true,
      session: {
        include: {
          group: true
        }
      }
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">TRIALS</p>
          <h1>Пробные занятия</h1>
        </div>
        <span className="admin-count">{trials.length} записей</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Ребёнок</th>
                <th>Родитель</th>
                <th>Группа</th>
                <th>Занятие</th>
                <th>HOLD до</th>
                <th>Оплата</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((trial) => (
                <tr key={trial.id}>
                  <td><span className="admin-status">{trial.status}</span></td>
                  <td>{trial.lead.childName}, {trial.lead.childAge}</td>
                  <td>{trial.lead.parentName}<br />{trial.lead.phone}</td>
                  <td>
                    {trial.session.group.ageMin}–{trial.session.group.ageMax}
                  </td>
                  <td>{formatAdminDate(trial.session.startsAt)}</td>
                  <td>{formatAdminDate(trial.expiresAt)}</td>
                  <td>
                    {trial.payment
                      ? `${trial.payment.status} · ${formatAdminMoney(
                          trial.payment.amountUzs
                        )}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {trials.length === 0 ? (
                <tr><td colSpan={7}>Пробных записей пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
