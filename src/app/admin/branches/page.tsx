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

  const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");
  const inactiveBranches = branches.filter((branch) => branch.status !== "ACTIVE");

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Филиалы</h1>
          <p className="admin-page-note">
            Сначала рабочие филиалы. Создание нового филиала вынесено вниз страницы.
          </p>
        </div>
        <span className="admin-count">{branches.length} филиалов</span>
      </div>

      <section className="admin-panel admin-branches-active-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Рабочие локации</p>
            <h2>Активные филиалы</h2>
            <small>
              Нажмите на карточку, чтобы открыть настройки филиала, тренеров, групп и расписания.
            </small>
          </div>
          <span className="admin-count">{activeBranches.length} активных</span>
        </div>

        <div className="admin-branch-card-grid">
          {activeBranches.map((branch) => {
            const sports = branch.sportLinks.map((link) => link.sport.nameRu);

            return (
              <Link
                className="admin-branch-card"
                href={`/admin/branches/${branch.id}`}
                key={branch.id}
              >
                <div className="admin-branch-card-top">
                  <span className="admin-status active">ACTIVE</span>
                  <span className="admin-branch-card-arrow">→</span>
                </div>

                <div className="admin-branch-card-main">
                  <span className="admin-branch-card-district">
                    {branch.districtRu || "Ташкент"}
                  </span>
                  <h3>{branch.publicNameRu}</h3>
                  <p>{branch.addressRu}</p>
                </div>

                <div className="admin-branch-card-meta">
                  <div>
                    <span>Направления</span>
                    <strong>{sports.length ? sports.join(" · ") : "—"}</strong>
                  </div>
                  <div>
                    <span>Группы</span>
                    <strong>{branch._count.groups}</strong>
                  </div>
                </div>
              </Link>
            );
          })}

          {activeBranches.length === 0 ? (
            <div className="dashboard-empty">
              Активных филиалов пока нет.
            </div>
          ) : null}
        </div>
      </section>

      {inactiveBranches.length ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <p className="admin-panel-kicker">Неактивные</p>
              <h2>Черновики и архив</h2>
              <small>
                Draft, Paused и Archived не смешиваются с рабочими филиалами.
              </small>
            </div>
            <span className="admin-count">{inactiveBranches.length}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Филиал</th>
                  <th>Адрес</th>
                  <th>Направления</th>
                  <th>Группы</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inactiveBranches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <strong className="admin-table-primary">
                        {branch.publicNameRu}
                      </strong>
                      <small className="admin-table-secondary">{branch.id}</small>
                    </td>
                    <td>{branch.addressRu}</td>
                    <td>
                      {branch.sportLinks.length
                        ? branch.sportLinks.map((link) => link.sport.nameRu).join(" · ")
                        : "—"}
                    </td>
                    <td>{branch._count.groups}</td>
                    <td>
                      <span className="admin-status">{branch.status}</span>
                    </td>
                    <td>
                      <Link href={`/admin/branches/${branch.id}`}>
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="admin-panel admin-branch-create-panel">
        <details className="admin-branch-create-details">
          <summary>
            <div>
              <p className="admin-panel-kicker">Новый филиал</p>
              <h2>Добавить филиал</h2>
              <small>
                Откройте форму только когда нужно создать новую локацию.
              </small>
            </div>
            <span>+ Создать</span>
          </summary>

          <div className="admin-branch-create-body">
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
                { name: "seoTitleRu", label: "SEO title RU" },
                { name: "seoTitleUz", label: "SEO title UZ" },
                { name: "seoDescriptionRu", label: "SEO description RU", type: "textarea" },
                { name: "seoDescriptionUz", label: "SEO description UZ", type: "textarea" },
                {
                  name: "status",
                  label: "Статус",
                  type: "select",
                  options: [
                    { value: "DRAFT", label: "Draft" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "PAUSED", label: "Paused" }
                  ]
                }
              ]}
              initialValues={{
                internalName: "",
                slug: "",
                publicNameRu: "",
                publicNameUz: "",
                districtRu: "",
                districtUz: "",
                addressRu: "",
                addressUz: "",
                landmarkRu: "",
                landmarkUz: "",
                publicPhone: "",
                seoTitleRu: "",
                seoTitleUz: "",
                seoDescriptionRu: "",
                seoDescriptionUz: "",
                status: "DRAFT"
              }}
            />
          </div>
        </details>
      </section>
    </>
  );
}
