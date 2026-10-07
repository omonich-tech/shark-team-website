import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { LifecycleStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSportEditPage({
  params
}: {
  params: Promise<{ sportId: string }>;
}) {
  const { sportId } = await params;
  const prisma = getPrisma();

  const sport = await prisma.sport.findUnique({
    where: { id: sportId },
    include: {
      branchLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { branch: true },
        orderBy: { branch: { publicNameRu: "asc" } }
      },
      coachLinks: {
        where: { status: LifecycleStatus.ACTIVE },
        include: { coach: true }
      },
      groups: {
        where: { status: { not: LifecycleStatus.ARCHIVED } },
        include: { branch: true, primaryCoach: true },
        orderBy: [{ ageMin: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!sport) notFound();

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">ВИД СПОРТА</p>
          <h1>{sport.nameRu}</h1>
        </div>
        <div className="admin-branch-head-actions">
          <span className="admin-status">{sport.status}</span>
          {sport.status === LifecycleStatus.ACTIVE ? (
            <Link
              className="button secondary dark"
              href={`/ru/sports/${sport.slug}`}
              target="_blank"
            >
              Открыть на сайте
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-branch-summary">
        <div>
          <span>Slug</span>
          <strong>/{sport.slug}</strong>
        </div>
        <div>
          <span>Филиалов</span>
          <strong>{sport.branchLinks.length}</strong>
        </div>
        <div>
          <span>Тренеров</span>
          <strong>{sport.coachLinks.length}</strong>
        </div>
        <div>
          <span>Групп</span>
          <strong>{sport.groups.length}</strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Публикация</p>
            <h2>Карточка вида спорта</h2>
            <small>
              ACTIVE-направление автоматически участвует в публичном каталоге.
            </small>
          </div>
        </div>

        <AdminEntityForm
          endpoint={`/api/admin/sports/${sport.id}`}
          fields={[
            { name: "status", label: "Статус", type: "select", options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PAUSED", label: "Paused" },
              { value: "DRAFT", label: "Draft" },
              { value: "ARCHIVED", label: "Archived" }
            ]},
            { name: "slug", label: "Slug сайта", required: true },
            { name: "nameRu", label: "Название RU", required: true },
            { name: "nameUz", label: "Название UZ", required: true },
            { name: "ageMin", label: "Возраст от", type: "number" },
            { name: "ageMax", label: "Возраст до", type: "number" },
            { name: "sortOrder", label: "Порядок на сайте", type: "number" },
            { name: "shortDescriptionRu", label: "Короткое описание RU", type: "textarea" },
            { name: "shortDescriptionUz", label: "Короткое описание UZ", type: "textarea" }
          ]}
          initialValues={{
            status: sport.status,
            slug: sport.slug,
            nameRu: sport.nameRu,
            nameUz: sport.nameUz,
            ageMin: sport.ageMin,
            ageMax: sport.ageMax,
            sortOrder: sport.sortOrder,
            shortDescriptionRu: sport.shortDescriptionRu,
            shortDescriptionUz: sport.shortDescriptionUz
          }}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Связи</p>
            <h2>Где работает направление</h2>
          </div>
          <Link href="/admin/branches">Управлять филиалами →</Link>
        </div>

        <div className="admin-sport-relations">
          <div>
            <span>Филиалы</span>
            {sport.branchLinks.map((link) => (
              <Link href={`/admin/branches/${link.branch.id}`} key={link.branchId}>
                {link.branch.publicNameRu}
              </Link>
            ))}
            {sport.branchLinks.length === 0 ? <small>Нет активных филиалов</small> : null}
          </div>

          <div>
            <span>Тренеры</span>
            {sport.coachLinks.map((link) => (
              <Link href={`/admin/coaches/${link.coach.id}`} key={link.coachId}>
                {[link.coach.firstName, link.coach.lastName].filter(Boolean).join(" ")}
              </Link>
            ))}
            {sport.coachLinks.length === 0 ? <small>Нет назначенных тренеров</small> : null}
          </div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Группы</p>
            <h2>Активные и рабочие группы</h2>
          </div>
          <Link href="/admin/groups">Все группы →</Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Филиал</th>
                <th>Возраст</th>
                <th>Тренер</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sport.groups.map((group) => (
                <tr key={group.id}>
                  <td><strong className="admin-table-primary">{group.internalName}</strong></td>
                  <td>{group.branch.publicNameRu}</td>
                  <td>{group.ageMin}–{group.ageMax}</td>
                  <td>
                    {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </td>
                  <td><span className="admin-status">{group.status}</span></td>
                  <td><Link href={`/admin/groups/${group.id}`}>Открыть →</Link></td>
                </tr>
              ))}
              {sport.groups.length === 0 ? (
                <tr><td colSpan={6}>Групп пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel admin-media-jump">
        <div>
          <p className="admin-panel-kicker">Медиа</p>
          <h2>Фото вида спорта</h2>
          <small>
            Главное изображение публичной карточки управляется через медиатеку.
          </small>
        </div>
        <Link className="button secondary dark" href="/admin/media">
          Открыть медиатеку
        </Link>
      </section>
    </>
  );
}
