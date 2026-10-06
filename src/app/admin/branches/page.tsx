import Link from "next/link";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage() {
  const prisma = getPrisma();
  const branches = await prisma.branch.findMany({
    include: {
      sportLinks: {
        where: { status: "ACTIVE" },
        include: { sport: true }
      },
      _count: {
        select: { groups: true }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });

  return (
    <>
      <div className="admin-page-head">
        <div><p className="eyebrow">SPORT</p><h1>Филиалы</h1></div>
        <span className="admin-count">{branches.length} филиалов</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head"><h2>Добавить филиал</h2></div>
        <AdminEntityForm
          endpoint="/api/admin/branches"
          method="POST"
          submitLabel="Создать филиал"
          fields={[
            { name: "internalName", label: "Внутреннее название", required: true },
            { name: "slug", label: "Slug", required: true, placeholder: "yunusabad-2" },
            { name: "publicNameRu", label: "Название RU", required: true },
            { name: "publicNameUz", label: "Название UZ", required: true },
            { name: "districtRu", label: "Район RU" },
            { name: "districtUz", label: "Район UZ" },
            { name: "addressRu", label: "Адрес RU", required: true },
            { name: "addressUz", label: "Адрес UZ", required: true },
            { name: "landmarkRu", label: "Ориентир RU" },
            { name: "landmarkUz", label: "Ориентир UZ" },
            { name: "publicPhone", label: "Публичный телефон" },
            {
              name: "status", label: "Статус", type: "select",
              options: [
                { value: "DRAFT", label: "Draft" },
                { value: "ACTIVE", label: "Active" },
                { value: "PAUSED", label: "Paused" }
              ]
            }
          ]}
          initialValues={{
            internalName: "", slug: "", publicNameRu: "", publicNameUz: "",
            districtRu: "", districtUz: "", addressRu: "", addressUz: "",
            landmarkRu: "", landmarkUz: "", publicPhone: "", status: "DRAFT"
          }}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Филиал</th><th>Адрес</th><th>Направления</th><th>Группы</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.publicNameRu}<br /><small>{branch.id}</small></td>
                  <td>{branch.addressRu}</td>
                  <td>
                    {branch.sportLinks.length
                      ? branch.sportLinks.map((link) => link.sport.nameRu).join(" · ")
                      : "—"}
                  </td>
                  <td>{branch._count.groups}</td>
                  <td><span className="admin-status">{branch.status}</span></td>
                  <td><Link href={`/admin/branches/${branch.id}`}>Открыть</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}