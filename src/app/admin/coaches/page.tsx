import Link from "next/link";
import { LifecycleStatus } from "@/generated/prisma/client";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCoachesPage() {
  const prisma = getPrisma();
  const coaches = await prisma.coach.findMany({
    include: {
      account: true,
      sportLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { sport: true }
      },
      branchLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { branch: true }
      },
      _count: {
        select: {
          primaryGroups: {
            where: { status: { not: LifecycleStatus.ARCHIVED } }
          }
        }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Тренеры</h1>
          <p className="admin-page-note">
            Профили, направления, филиалы, публичные данные и доступ в кабинет тренера.
          </p>
        </div>
        <span className="admin-count">{coaches.length} тренеров</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Новый тренер</p>
            <h2>Добавить профиль</h2>
            <small>После создания назначьте виды спорта, филиалы и фото.</small>
          </div>
        </div>

        <AdminEntityForm
          endpoint="/api/admin/coaches"
          method="POST"
          submitLabel="Создать тренера"
          fields={[
            { name: "firstName", label: "Имя", required: true },
            { name: "lastName", label: "Фамилия" },
            { name: "phonePrivate", label: "Телефон (внутренний)" },
            { name: "status", label: "Статус", type: "select", options: [
              { value: "DRAFT", label: "Draft" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" }
            ]},
            { name: "experienceYears", label: "Опыт, лет", type: "number" },
            { name: "startedAt", label: "В SHARK TEAM с", type: "date" },
            { name: "publicBioRu", label: "Публичное описание RU", type: "textarea" },
            { name: "publicBioUz", label: "Публичное описание UZ", type: "textarea" },
            { name: "seoTitleRu", label: "SEO title RU" },
            { name: "seoTitleUz", label: "SEO title UZ" },
            { name: "seoDescriptionRu", label: "SEO description RU", type: "textarea" },
            { name: "seoDescriptionUz", label: "SEO description UZ", type: "textarea" }
          ]}
          initialValues={{
            firstName: "",
            lastName: "",
            phonePrivate: "",
            status: "DRAFT",
            experienceYears: null,
            startedAt: null,
            publicBioRu: "",
            publicBioUz: "",
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
            <p className="admin-panel-kicker">Команда</p>
            <h2>Все тренеры</h2>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Тренер</th>
                <th>Направления</th>
                <th>Филиалы</th>
                <th>Группы</th>
                <th>Кабинет</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((coach) => (
                <tr key={coach.id}>
                  <td>
                    <strong className="admin-table-primary">
                      {[coach.firstName, coach.lastName].filter(Boolean).join(" ")}
                    </strong>
                    <small className="admin-table-secondary">{coach.id}</small>
                  </td>
                  <td>
                    {coach.sportLinks.length
                      ? coach.sportLinks.map((link) => link.sport.nameRu).join(" · ")
                      : "—"}
                  </td>
                  <td>
                    {coach.branchLinks.length
                      ? coach.branchLinks.map((link) => link.branch.publicNameRu).join(" · ")
                      : "—"}
                  </td>
                  <td>{coach._count.primaryGroups}</td>
                  <td>
                    <span className={coach.account?.isActive ? "admin-status active" : "admin-status"}>
                      {coach.account?.isActive
                        ? "Активен"
                        : coach.account
                          ? "Отключён"
                          : "Нет"}
                    </span>
                  </td>
                  <td><span className="admin-status">{coach.status}</span></td>
                  <td>
                    <Link href={`/admin/coaches/${coach.id}`}>Открыть →</Link>
                  </td>
                </tr>
              ))}
              {coaches.length === 0 ? (
                <tr><td colSpan={7}>Тренеров пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
