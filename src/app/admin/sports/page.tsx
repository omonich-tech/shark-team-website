import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSportsPage() {
  const prisma = getPrisma();
  const sports = await prisma.sport.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <div className="admin-page-head">
        <div><p className="eyebrow">SPORT</p><h1>Виды спорта</h1></div>
        <span className="admin-count">{sports.length}</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head"><h2>Добавить вид спорта</h2></div>
        <AdminEntityForm
          endpoint="/api/admin/sports"
          method="POST"
          submitLabel="Создать вид спорта"
          fields={[
            { name: "nameRu", label: "Название RU", required: true },
            { name: "nameUz", label: "Название UZ", required: true },
            { name: "slug", label: "Slug", required: true, placeholder: "volleyball" },
            { name: "status", label: "Статус", type: "select", options: [
              { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }
            ]}
          ]}
          initialValues={{ nameRu: "", nameUz: "", slug: "", status: "DRAFT" }}
        />
      </section>

      <div className="admin-group-list">
        {sports.map((sport) => (
          <section className="admin-panel admin-editor-panel" key={sport.id}>
            <div className="admin-panel-head"><h2>{sport.nameRu}</h2><small>{sport.id}</small></div>
            <AdminEntityForm
              endpoint={`/api/admin/sports/${sport.id}`}
              fields={[
                { name: "nameRu", label: "Название RU", required: true },
                { name: "nameUz", label: "Название UZ", required: true },
                { name: "status", label: "Статус", type: "select", options: [
                  { value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" },
                  { value: "PAUSED", label: "Paused" }, { value: "ARCHIVED", label: "Archived" }
                ]},
                { name: "shortDescriptionRu", label: "Описание RU", type: "textarea" },
                { name: "shortDescriptionUz", label: "Описание UZ", type: "textarea" }
              ]}
              initialValues={{
                nameRu: sport.nameRu, nameUz: sport.nameUz, status: sport.status,
                shortDescriptionRu: sport.shortDescriptionRu, shortDescriptionUz: sport.shortDescriptionUz
              }}
            />
          </section>
        ))}
      </div>
    </>
  );
}