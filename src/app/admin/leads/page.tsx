import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminLeadsPage() {
  const prisma = getPrisma();

  const leads = await prisma.lead.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      group: true,
      selectedSession: true
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SALES</p>
          <h1>Лиды</h1>
        </div>
        <span className="admin-count">{leads.length} записей</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Создан</th>
                <th>Статус</th>
                <th>Родитель</th>
                <th>Ребёнок</th>
                <th>Телефон</th>
                <th>Группа</th>
                <th>Session</th>
                <th>Источник</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{formatAdminDate(lead.createdAt)}</td>
                  <td><span className="admin-status">{lead.status}</span></td>
                  <td>{lead.parentName}</td>
                  <td>{lead.childName}, {lead.childAge}</td>
                  <td>{lead.phone}</td>
                  <td>
                    {lead.group
                      ? `${lead.group.ageMin}–${lead.group.ageMax}`
                      : "—"}
                  </td>
                  <td>{formatAdminDate(lead.selectedSession?.startsAt)}</td>
                  <td>
                    {lead.utmSource ?? lead.source}
                    {lead.utmCampaign ? ` / ${lead.utmCampaign}` : ""}
                  </td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr><td colSpan={8}>Лидов пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
