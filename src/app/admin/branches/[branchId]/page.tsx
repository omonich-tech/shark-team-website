import Link from "next/link";
import { notFound } from "next/navigation";
import { LifecycleStatus } from "@/generated/prisma/client";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { BranchSportsEditor } from "@/components/admin/branch-sports-editor";
import { BranchWorkingHoursEditor } from "@/components/admin/branch-working-hours-editor";
import { BranchCoachesEditor } from "@/components/admin/branch-coaches-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
          select: { id: true }
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
    </>
  );
}
