import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const prisma = getPrisma();

  const logs = await prisma.auditLog.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SYSTEM</p>
          <h1>История изменений</h1>
        </div>
        <span className="admin-count">Последние {logs.length}</span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Кто</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatAdminDate(log.createdAt)}</td>
                  <td>
                    {log.actorType}
                    {log.actorId ? ` · ${log.actorId}` : ""}
                  </td>
                  <td>{log.action}</td>
                  <td>{log.entityType}</td>
                  <td>{log.entityId}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5}>Изменений пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
