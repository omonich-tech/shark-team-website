import { notFound } from "next/navigation";
import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCoachEditPage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = await params;
  const prisma = getPrisma();
  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach) notFound();

  return (
    <>
      <div className="admin-page-head">
        <div><p className="eyebrow">ТРЕНЕР</p><h1>{[coach.firstName, coach.lastName].filter(Boolean).join(" ")}</h1></div>
        <span className="admin-count">{coach.id}</span>
      </div>
      <section className="admin-panel admin-editor-panel">
        <AdminEntityForm
          endpoint={`/api/admin/coaches/${coach.id}`}
          fields={[
            { name: "status", label: "Статус", type: "select", options: [
              { value: "ACTIVE", label: "Active" }, { value: "PAUSED", label: "Paused" },
              { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }
            ]},
            { name: "firstName", label: "Имя", required: true }, { name: "lastName", label: "Фамилия" },
            { name: "phonePrivate", label: "Телефон (внутренний)" }, { name: "experienceYears", label: "Опыт, лет", type: "number" },
            { name: "educationRu", label: "Образование RU", type: "textarea" }, { name: "educationUz", label: "Образование UZ", type: "textarea" },
            { name: "qualificationRu", label: "Квалификация RU", type: "textarea" }, { name: "qualificationUz", label: "Квалификация UZ", type: "textarea" },
            { name: "publicBioRu", label: "Публичное описание RU", type: "textarea" }, { name: "publicBioUz", label: "Публичное описание UZ", type: "textarea" }
          ]}
          initialValues={{
            status: coach.status, firstName: coach.firstName, lastName: coach.lastName,
            phonePrivate: coach.phonePrivate, experienceYears: coach.experienceYears,
            educationRu: coach.educationRu, educationUz: coach.educationUz,
            qualificationRu: coach.qualificationRu, qualificationUz: coach.qualificationUz,
            publicBioRu: coach.publicBioRu, publicBioUz: coach.publicBioUz
          }}
        />
      </section>
    </>
  );
}