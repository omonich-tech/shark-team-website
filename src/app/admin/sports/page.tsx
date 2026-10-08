import Link from "next/link";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSportsPage() {
  const prisma = getPrisma();
  const sports = await prisma.sport.findMany({
    include: {
      _count: {
        select: {
          groups: true,
          branchLinks: {
            where: { status: LifecycleStatus.ACTIVE }
          },
          coachLinks: {
            where: { status: LifecycleStatus.ACTIVE }
          }
        }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Виды спорта</h1>
          <p className="admin-page-note">
            Управление направлениями, которые отображаются на публичном сайте.
          </p>
        </div>
        <span className="admin-count">{sports.length}</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Новое направление</p>
            <h2>Добавить вид спорта</h2>
            <small>Создайте карточку, затем при необходимости добавьте фото в медиатеке.</small>
          </div>
        </div>
        <AdminEntityForm
          endpoint="/api/admin/sports"
          method="POST"
          submitLabel="Создать вид спорта"
          fields={[
            { name: "nameRu", label: "Название RU", required: true },
            { name: "nameUz", label: "Название UZ", required: true },
            { name: "slug", label: "Slug сайта", required: true, placeholder: "volleyball" },
            { name: "status", label: "Статус", type: "select", options: [
              { value: "DRAFT", label: "Draft" },
              { value: "ACTIVE", label: "Active" }
            ]},
            { name: "ageMin", label: "Возраст от", type: "number" },
            { name: "ageMax", label: "Возраст до", type: "number" },
            { name: "sortOrder", label: "Порядок", type: "number" },
            { name: "shortDescriptionRu", label: "Короткое описание RU", type: "textarea" },
            { name: "shortDescriptionUz", label: "Короткое описание UZ", type: "textarea" },
            { name: "seoTitleRu", label: "SEO title RU" },
            { name: "seoTitleUz", label: "SEO title UZ" },
            { name: "seoDescriptionRu", label: "SEO description RU", type: "textarea" },
            { name: "seoDescriptionUz", label: "SEO description UZ", type: "textarea" }
          ]}
          initialValues={{
            nameRu: "",
            nameUz: "",
            slug: "",
            status: "DRAFT",
            ageMin: null,
            ageMax: null,
            sortOrder: sports.length,
            shortDescriptionRu: "",
            shortDescriptionUz: "",
            seoTitleRu: "",
            seoTitleUz: "",
            seoDescriptionRu: "",
            seoDescriptionUz: ""
          }}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Каталог</p>
            <h2>Все направления</h2>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Вид спорта</th>
                <th>Возраст</th>
                <th>Филиалы</th>
                <th>Тренеры</th>
                <th>Группы</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sports.map((sport) => (
                <tr key={sport.id}>
                  <td>
                    <strong className="admin-table-primary">{sport.nameRu}</strong>
                    <small className="admin-table-secondary">/{sport.slug}</small>
                  </td>
                  <td>
                    {sport.ageMin !== null || sport.ageMax !== null
                      ? `${sport.ageMin ?? "—"}–${sport.ageMax ?? "—"}`
                      : "—"}
                  </td>
                  <td>{sport._count.branchLinks}</td>
                  <td>{sport._count.coachLinks}</td>
                  <td>{sport._count.groups}</td>
                  <td><span className="admin-status">{sport.status}</span></td>
                  <td>
                    <Link href={`/admin/sports/${sport.id}`}>Открыть →</Link>
                  </td>
                </tr>
              ))}
              {sports.length === 0 ? (
                <tr><td colSpan={7}>Видов спорта пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
