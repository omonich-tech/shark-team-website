import Link from "next/link";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCoachesPage() {
  const prisma = getPrisma();
  const coaches = await prisma.coach.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <div className="admin-page-head">
        <div><p className="eyebrow">SPORT</p><h1>Тренеры</h1></div>
        <span className="admin-count">{coaches.length} тренеров</span>
      </div>
      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head"><h2>Добавить тренера</h2></div>
        <AdminEntityForm
          endpoint="/api/admin/coaches"
          method="POST"
          submitLabel="Создать тренера"
          fields={[
            { name: "firstName", label: "Имя", required: true },
            { name: "lastName", label: "Фамилия" },
            { name: "phonePrivate", label: "Телефон (внутренний)" },
            { name: "status", label: "Статус", type: "select", options: [
              { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" }
            ]}
          ]}
          initialValues={{ firstName: "", lastName: "", phonePrivate: "", status: "DRAFT" }}
        />
      </section>
      <section className="admin-panel"><div className="admin-table-wrap">
        <table className="admin-table"><thead><tr><th>Тренер</th><th>Статус</th><th></th></tr></thead>
          <tbody>{coaches.map((coach) => (
            <tr key={coach.id}>
              <td>{[coach.firstName, coach.lastName].filter(Boolean).join(" ")}<br /><small>{coach.id}</small></td>
              <td><span className="admin-status">{coach.status}</span></td>
              <td><Link href={`/admin/coaches/${coach.id}`}>Открыть</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div></section>
    </>
  );
}