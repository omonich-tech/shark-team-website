import Link from "next/link";
import { notFound } from "next/navigation";
import { LifecycleStatus } from "@/generated/prisma/client";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { BranchSportsEditor } from "@/components/admin/branch-sports-editor";
import { BranchWorkingHoursEditor } from "@/components/admin/branch-working-hours-editor";
import { BranchCoachesEditor } from "@/components/admin/branch-coaches-editor";
import { BranchDangerZone } from "@/components/admin/branch-danger-zone";
import { GroupCreateForm } from "@/components/admin/group-create-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const weekdayLabel: Record<string, string> = {
  MONDAY: "Пн",
  TUESDAY: "Вт",
  WEDNESDAY: "Ср",
  THURSDAY: "Чт",
  FRIDAY: "Пт",
  SATURDAY: "Сб",
  SUNDAY: "Вс"
};

function time(value: number) {
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}

export default async function AdminBranchEditPage({
  params
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const prisma = getPrisma();

  const [branch, sports, coaches] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        sportLinks: true,
        coachLinks: true,
        groups: {
          where: { status: { not: LifecycleStatus.ARCHIVED } },
          include: {
            sport: true,
            primaryCoach: true,
            scheduleRules: {
              where: { status: LifecycleStatus.ACTIVE }
            }
          },
          orderBy: [{ sportId: "asc" }, { ageMin: "asc" }]
        }
      }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.coach.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    })
  ]);

  if (!branch) notFound();

  const activeSportIds = branch.sportLinks
    .filter((link) => link.status === LifecycleStatus.ACTIVE)
    .map((link) => link.sportId);

  const activeCoachIds = branch.coachLinks
    .filter((link) => link.status === LifecycleStatus.ACTIVE)
    .map((link) => link.coachId);

  const branchSports = sports.filter((sport) =>
    activeSportIds.includes(sport.id)
  );
  const branchCoaches = coaches.filter((coach) =>
    activeCoachIds.includes(coach.id)
  );

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">ФИЛИАЛ</p>
          <h1>{branch.publicNameRu}</h1>
        </div>
        <div className="admin-branch-head-actions">
          <span className="admin-status">{branch.status}</span>
          <Link
            className="button secondary dark"
            href={`/ru/branches/${branch.slug}`}
            target="_blank"
          >
            Открыть на сайте
          </Link>
        </div>
      </div>

      <div className="admin-branch-summary">
        <div>
          <span>Slug</span>
          <strong>/{branch.slug}</strong>
        </div>
        <div>
          <span>Направлений</span>
          <strong>{activeSportIds.length}</strong>
        </div>
        <div>
          <span>Тренеров</span>
          <strong>{activeCoachIds.length}</strong>
        </div>
        <div>
          <span>Групп</span>
          <strong>{branch.groups.length}</strong>
        </div>
        <div>
          <span>ID</span>
          <strong>{branch.id}</strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Основное</p>
            <h2>Название и публикация</h2>
            <small>Эти данные управляют названием филиала и его публичным адресом на сайте.</small>
          </div>
        </div>
        <AdminEntityForm
          endpoint={`/api/admin/branches/${branch.id}`}
          fields={[
            { name: "status", label: "Статус", type: "select", options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PAUSED", label: "Paused" },
              { value: "DRAFT", label: "Draft" },
              { value: "ARCHIVED", label: "Archived" }
            ]},
            { name: "internalName", label: "Внутреннее название", required: true },
            { name: "slug", label: "Slug сайта", required: true, placeholder: "school-117" },
            { name: "publicNameRu", label: "Публичное название RU", required: true },
            { name: "publicNameUz", label: "Публичное название UZ", required: true },
            { name: "districtRu", label: "Район RU" },
            { name: "districtUz", label: "Район UZ" },
            { name: "addressRu", label: "Адрес RU", required: true },
            { name: "addressUz", label: "Адрес UZ", required: true },
            { name: "postalCode", label: "Почтовый индекс" },
            { name: "landmarkRu", label: "Ориентир RU" },
            { name: "landmarkUz", label: "Ориентир UZ" },
            { name: "publicPhone", label: "Публичный телефон", placeholder: "+998 ..." },
            { name: "latitude", label: "Широта", type: "number" },
            { name: "longitude", label: "Долгота", type: "number" },
            { name: "entranceNoteRu", label: "Как найти вход RU", type: "textarea" },
            { name: "entranceNoteUz", label: "Как найти вход UZ", type: "textarea" },
            { name: "facilityNotesRu", label: "Описание объекта RU", type: "textarea" },
            { name: "facilityNotesUz", label: "Описание объекта UZ", type: "textarea" },
            { name: "seoTitleRu", label: "SEO title RU" },
            { name: "seoTitleUz", label: "SEO title UZ" },
            { name: "seoDescriptionRu", label: "SEO description RU", type: "textarea" },
            { name: "seoDescriptionUz", label: "SEO description UZ", type: "textarea" }
          ]}
          initialValues={{
            status: branch.status,
            internalName: branch.internalName,
            slug: branch.slug,
            publicNameRu: branch.publicNameRu,
            publicNameUz: branch.publicNameUz,
            districtRu: branch.districtRu,
            districtUz: branch.districtUz,
            addressRu: branch.addressRu,
            addressUz: branch.addressUz,
            postalCode: branch.postalCode,
            landmarkRu: branch.landmarkRu,
            landmarkUz: branch.landmarkUz,
            publicPhone: branch.publicPhone,
            latitude: branch.latitude ? Number(branch.latitude) : null,
            longitude: branch.longitude ? Number(branch.longitude) : null,
            entranceNoteRu: branch.entranceNoteRu,
            entranceNoteUz: branch.entranceNoteUz,
            facilityNotesRu: branch.facilityNotesRu,
            facilityNotesUz: branch.facilityNotesUz,
            seoTitleRu: branch.seoTitleRu,
            seoTitleUz: branch.seoTitleUz,
            seoDescriptionRu: branch.seoDescriptionRu,
            seoDescriptionUz: branch.seoDescriptionUz
          }}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Команда</p>
            <h2>Тренеры филиала</h2>
            <small>
              Выберите тренеров, которые работают в этом филиале. Эти связи показываются
              на публичной странице филиала и в профиле тренера.
            </small>
          </div>
        </div>
        <BranchCoachesEditor
          branchId={branch.id}
          coaches={coaches.map((coach) => ({
            id: coach.id,
            name: [coach.firstName, coach.lastName].filter(Boolean).join(" "),
            meta: coach.status
          }))}
          initialCoachIds={activeCoachIds}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">График</p>
            <h2>Дни и время работы</h2>
            <small>
              Выберите дни недели кликом и задайте время. Эти данные автоматически
              показываются на публичной странице филиала и на страницах видов спорта.
            </small>
          </div>
        </div>
        <BranchWorkingHoursEditor
          branchId={branch.id}
          initialWorkingHoursRu={branch.workingHoursRu}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Направления</p>
            <h2>Виды спорта в филиале</h2>
            <small>
              Отмеченные направления показываются на публичной странице филиала.
            </small>
          </div>
        </div>
        <BranchSportsEditor
          branchId={branch.id}
          sports={sports.map((sport) => ({ id: sport.id, name: sport.nameRu }))}
          initialSportIds={activeSportIds}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Тренировки</p>
            <h2>Группы филиала</h2>
            <small>
              Создавайте группы прямо в филиале. Филиал будет выбран автоматически.
            </small>
          </div>
          <span className="admin-count">{branch.groups.length} групп</span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-group-catalog">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Спорт</th>
                <th>Тренер</th>
                <th>Возраст</th>
                <th>Расписание</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {branch.groups.map((group) => {
                const schedule = Array.from(
                  new Set(
                    group.scheduleRules.map(
                      (rule) =>
                        `${weekdayLabel[rule.weekday]} ${time(rule.startMinutes)}–${time(rule.endMinutes)}`
                    )
                  )
                ).join(" · ");

                return (
                  <tr key={group.id}>
                    <td>
                      <strong className="admin-table-primary">
                        {group.internalName}
                      </strong>
                    </td>
                    <td>{group.sport.nameRu}</td>
                    <td>
                      {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td>{group.ageMin}–{group.ageMax}</td>
                    <td>{schedule || "—"}</td>
                    <td>
                      <span className="admin-status">{group.status}</span>
                    </td>
                    <td>
                      <Link href={`/admin/groups/${group.id}`}>Открыть →</Link>
                    </td>
                  </tr>
                );
              })}
              {branch.groups.length === 0 ? (
                <tr>
                  <td colSpan={7}>В этом филиале групп пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <details className="admin-inline-create">
          <summary>+ Добавить группу</summary>
          <div className="admin-inline-create-body">
            {branchSports.length && branchCoaches.length ? (
              <GroupCreateForm
                branches={[{ id: branch.id, name: branch.publicNameRu }]}
                sports={branchSports.map((sport) => ({
                  id: sport.id,
                  name: sport.nameRu
                }))}
                coaches={branchCoaches.map((coach) => ({
                  id: coach.id,
                  name: [coach.firstName, coach.lastName]
                    .filter(Boolean)
                    .join(" ")
                }))}
                fixedBranchId={branch.id}
              />
            ) : (
              <div className="admin-inline-warning">
                Сначала выберите минимум один вид спорта и одного тренера в блоках выше.
              </div>
            )}
          </div>
        </details>
      </section>

      <BranchDangerZone branchId={branch.id} branchName={branch.publicNameRu} />
    </>
  );
}
