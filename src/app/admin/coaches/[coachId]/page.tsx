import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { CoachAccessForm } from "@/components/admin/coach-access-form";
import { CoachRelationsEditor } from "@/components/admin/coach-relations-editor";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

export default async function AdminCoachEditPage({
  params
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = await params;
  const prisma = getPrisma();

  const [coach, sports, branches] = await Promise.all([
    prisma.coach.findUnique({
      where: { id: coachId },
      include: {
        account: true,
        sportLinks: true,
        branchLinks: true,
        primaryGroups: {
          where: { status: { not: LifecycleStatus.ARCHIVED } },
          include: { branch: true, sport: true },
          orderBy: [{ branchId: "asc" }, { ageMin: "asc" }]
        }
      }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    }),
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: { publicNameRu: "asc" }
    })
  ]);

  if (!coach) notFound();

  const activeSportIds = coach.sportLinks
    .filter((link) => link.status === LifecycleStatus.ACTIVE)
    .map((link) => link.sportId);

  const activeBranchIds = coach.branchLinks
    .filter((link) => link.status === LifecycleStatus.ACTIVE)
    .map((link) => link.branchId);

  const fullName = [coach.firstName, coach.lastName].filter(Boolean).join(" ");

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">ТРЕНЕР</p>
          <h1>{fullName}</h1>
        </div>
        <div className="admin-branch-head-actions">
          <span className="admin-status">{coach.status}</span>
          {coach.status === LifecycleStatus.ACTIVE ? (
            <Link
              className="button secondary dark"
              href="/ru/coaches"
              target="_blank"
            >
              Открыть на сайте
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-branch-summary">
        <div>
          <span>Направлений</span>
          <strong>{activeSportIds.length}</strong>
        </div>
        <div>
          <span>Филиалов</span>
          <strong>{activeBranchIds.length}</strong>
        </div>
        <div>
          <span>Групп</span>
          <strong>{coach.primaryGroups.length}</strong>
        </div>
        <div>
          <span>Кабинет</span>
          <strong>
            {coach.account?.isActive
              ? "Активен"
              : coach.account
                ? "Отключён"
                : "Не создан"}
          </strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Профиль</p>
            <h2>Данные тренера</h2>
            <small>
              Публичные поля автоматически используются на сайте. Внутренний телефон публично не показывается.
            </small>
          </div>
        </div>

        <AdminEntityForm
          endpoint={`/api/admin/coaches/${coach.id}`}
          fields={[
            { name: "status", label: "Статус", type: "select", options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PAUSED", label: "Paused" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ARCHIVED", label: "Archived" }
            ]},
            { name: "firstName", label: "Имя", required: true },
            { name: "lastName", label: "Фамилия" },
            { name: "phonePrivate", label: "Телефон (внутренний)" },
            { name: "experienceYears", label: "Опыт, лет", type: "number" },
            { name: "startedAt", label: "В SHARK TEAM с", type: "date" },
            { name: "educationRu", label: "Образование RU", type: "textarea" },
            { name: "educationUz", label: "Образование UZ", type: "textarea" },
            { name: "qualificationRu", label: "Квалификация RU", type: "textarea" },
            { name: "qualificationUz", label: "Квалификация UZ", type: "textarea" },
            { name: "publicBioRu", label: "Публичное описание RU", type: "textarea" },
            { name: "publicBioUz", label: "Публичное описание UZ", type: "textarea" },
            { name: "seoTitleRu", label: "SEO title RU" },
            { name: "seoTitleUz", label: "SEO title UZ" },
            { name: "seoDescriptionRu", label: "SEO description RU", type: "textarea" },
            { name: "seoDescriptionUz", label: "SEO description UZ", type: "textarea" }
          ]}
          initialValues={{
            status: coach.status,
            firstName: coach.firstName,
            lastName: coach.lastName,
            phonePrivate: coach.phonePrivate,
            experienceYears: coach.experienceYears,
            startedAt: dateValue(coach.startedAt),
            educationRu: coach.educationRu,
            educationUz: coach.educationUz,
            qualificationRu: coach.qualificationRu,
            qualificationUz: coach.qualificationUz,
            publicBioRu: coach.publicBioRu,
            publicBioUz: coach.publicBioUz,
            seoTitleRu: coach.seoTitleRu,
            seoTitleUz: coach.seoTitleUz,
            seoDescriptionRu: coach.seoDescriptionRu,
            seoDescriptionUz: coach.seoDescriptionUz
          }}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Назначения</p>
            <h2>Спорт и филиалы</h2>
            <small>
              Эти связи управляют публичным профилем тренера и доступными рабочими локациями.
            </small>
          </div>
        </div>

        <CoachRelationsEditor
          coachId={coach.id}
          sports={sports.map((sport) => ({
            id: sport.id,
            label: sport.nameRu,
            meta: sport.status
          }))}
          branches={branches.map((branch) => ({
            id: branch.id,
            label: branch.publicNameRu,
            meta: branch.status
          }))}
          initialSportIds={activeSportIds}
          initialBranchIds={activeBranchIds}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Нагрузка</p>
            <h2>Группы тренера</h2>
          </div>
          <Link href="/admin/groups">Все группы →</Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Вид спорта</th>
                <th>Филиал</th>
                <th>Возраст</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coach.primaryGroups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <strong className="admin-table-primary">{group.internalName}</strong>
                  </td>
                  <td>{group.sport.nameRu}</td>
                  <td>{group.branch.publicNameRu}</td>
                  <td>{group.ageMin}–{group.ageMax}</td>
                  <td><span className="admin-status">{group.status}</span></td>
                  <td>
                    <Link href={`/admin/groups/${group.id}`}>Открыть →</Link>
                  </td>
                </tr>
              ))}
              {coach.primaryGroups.length === 0 ? (
                <tr><td colSpan={6}>Групп пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Доступ</p>
            <h2>Кабинет тренера</h2>
            <small>
              Логин и пароль относятся только к рабочему Coach Cabinet.
            </small>
          </div>
          <span className="admin-count">
            {coach.account?.isActive
              ? "Активен"
              : coach.account
                ? "Отключён"
                : "Не создан"}
          </span>
        </div>

        <CoachAccessForm
          coachId={coach.id}
          account={
            coach.account
              ? {
                  username: coach.account.username,
                  isActive: coach.account.isActive
                }
              : null
          }
        />
      </section>

      <section className="admin-panel admin-media-jump">
        <div>
          <p className="admin-panel-kicker">Медиа</p>
          <h2>Фото тренера</h2>
          <small>
            Публичное фото профиля управляется через медиатеку.
          </small>
        </div>
        <Link className="button secondary dark" href="/admin/media">
          Открыть медиатеку
        </Link>
      </section>
    </>
  );
}
