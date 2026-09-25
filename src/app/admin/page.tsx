import {
  LeadStatus,
  PaymentStatus,
  TrialBookingStatus
} from "@/generated/prisma/client";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const prisma = getPrisma();
  const now = new Date();

  const [
    leads,
    trialHolds,
    confirmedTrials,
    parents,
    children,
    paid,
    recentLeads
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.trialBooking.count({
      where: {
        status: {
          in: [
            TrialBookingStatus.HOLD,
            TrialBookingStatus.PAYMENT_PENDING
          ]
        }
      }
    }),
    prisma.trialBooking.count({
      where: {
        status: TrialBookingStatus.CONFIRMED,
        session: {
          startsAt: { gt: now }
        }
      }
    }),
    prisma.parent.count(),
    prisma.child.count(),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID
      },
      _sum: {
        amountUzs: true
      },
      _count: true
    }),
    prisma.lead.findMany({
      take: 8,
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  const metrics = [
    ["Лиды", leads],
    ["Активные HOLD", trialHolds],
    ["Подтверждённые пробные", confirmedTrials],
    ["Родители", parents],
    ["Дети", children],
    ["Оплачено пробных", paid._count]
  ] as const;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SHARK TEAM CRM</p>
          <h1>Dashboard</h1>
        </div>
        <div className="admin-revenue">
          <span>Оплачено</span>
          <strong>{formatAdminMoney(paid._sum.amountUzs ?? 0)}</strong>
        </div>
      </div>

      <section className="admin-metrics">
        {metrics.map(([label, value]) => (
          <article className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Последние лиды</h2>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Родитель</th>
                <th>Ребёнок</th>
                <th>Телефон</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatAdminDate(lead.createdAt)}</td>
                  <td>{lead.parentName}</td>
                  <td>
                    {lead.childName}, {lead.childAge}
                  </td>
                  <td>{lead.phone}</td>
                  <td>
                    <span className="admin-status">{lead.status}</span>
                  </td>
                </tr>
              ))}
              {recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5}>Лидов пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
