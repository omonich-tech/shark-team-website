import { LifecycleStatus } from "@/generated/prisma/client";
import { GroupEditor } from "@/components/admin/group-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
}

export default async function AdminGroupsPage() {
  const prisma = getPrisma();

  const groups = await prisma.trainingGroup.findMany({
    where: { branchId: "BR-SCHOOL-117-01" },
    include: {
      scheduleRules: {
        where: { status: LifecycleStatus.ACTIVE }
      }
    },
    orderBy: { ageMin: "asc" }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Группы</h1>
        </div>
        <span className="admin-count">{groups.length} групп</span>
      </div>

      <div className="admin-group-list">
        {groups.map((group) => (
          <section className="admin-panel admin-editor-panel" key={group.id}>
            <GroupEditor
              group={{
                id: group.id,
                ageMin: group.ageMin,
                ageMax: group.ageMax,
                capacityRegular: group.capacityRegular,
                capacityTrial: group.capacityTrial,
                status: group.status,
                enrollmentStatus: group.enrollmentStatus,
                schedule: group.scheduleRules.map((rule) => ({
                  weekday: rule.weekday,
                  start: formatMinutes(rule.startMinutes),
                  end: formatMinutes(rule.endMinutes)
                }))
              }}
            />
          </section>
        ))}
      </div>
    </>
  );
}
