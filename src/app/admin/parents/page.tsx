import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminParentsPage() {
  const prisma = getPrisma();

  const parents = await prisma.parent.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      children: true,
      _count: {
        select: {
          leads: true
        }
      }
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">CLIENTS</p>
          <h1>Родители</h1>
        </div>
        <span className="admin-count">{parents.length} записей</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Язык</th>
                <th>Дети</th>
                <th>Лиды</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => (
                <tr key={parent.id}>
                  <td>{parent.name}</td>
                  <td>{parent.phone}</td>
                  <td>{parent.locale.toUpperCase()}</td>
                  <td>{parent.children.map((child) => child.name).join(", ") || "—"}</td>
                  <td>{parent._count.leads}</td>
                  <td>{formatAdminDate(parent.createdAt)}</td>
                </tr>
              ))}
              {parents.length === 0 ? (
                <tr><td colSpan={6}>Подтверждённых родителей пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
