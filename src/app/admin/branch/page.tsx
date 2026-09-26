import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBranchPage() {
  const prisma = getPrisma();
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: "BR-SCHOOL-117-01" }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Филиал</h1>
        </div>
        <span className="admin-count">{branch.internalName}</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <AdminEntityForm
          endpoint={`/api/admin/branches/${branch.id}`}
          fields={[
            {
              name: "status",
              label: "Статус",
              type: "select",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "PAUSED", label: "Paused" },
                { value: "DRAFT", label: "Draft" },
                { value: "ARCHIVED", label: "Archived" }
              ]
            },
            { name: "publicNameRu", label: "Название RU", required: true },
            { name: "publicNameUz", label: "Название UZ", required: true },
            { name: "districtRu", label: "Район RU" },
            { name: "districtUz", label: "Район UZ" },
            { name: "addressRu", label: "Адрес RU", required: true },
            { name: "addressUz", label: "Адрес UZ", required: true },
            { name: "postalCode", label: "Индекс" },
            { name: "landmarkRu", label: "Ориентир RU" },
            { name: "landmarkUz", label: "Ориентир UZ" },
            { name: "publicPhone", label: "Публичный телефон" },
            { name: "workingHoursRu", label: "Время работы RU" },
            { name: "workingHoursUz", label: "Время работы UZ" },
            { name: "latitude", label: "Latitude", type: "number" },
            { name: "longitude", label: "Longitude", type: "number" },
            {
              name: "entranceNoteRu",
              label: "Как найти вход RU",
              type: "textarea"
            },
            {
              name: "entranceNoteUz",
              label: "Как найти вход UZ",
              type: "textarea"
            },
            {
              name: "facilityNotesRu",
              label: "Описание объекта RU",
              type: "textarea"
            },
            {
              name: "facilityNotesUz",
              label: "Описание объекта UZ",
              type: "textarea"
            }
          ]}
          initialValues={{
            status: branch.status,
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
            workingHoursRu: branch.workingHoursRu,
            workingHoursUz: branch.workingHoursUz,
            latitude: branch.latitude ? Number(branch.latitude) : null,
            longitude: branch.longitude ? Number(branch.longitude) : null,
            entranceNoteRu: branch.entranceNoteRu,
            entranceNoteUz: branch.entranceNoteUz,
            facilityNotesRu: branch.facilityNotesRu,
            facilityNotesUz: branch.facilityNotesUz
          }}
        />
      </section>
    </>
  );
}
