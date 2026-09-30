import Link from "next/link";
import { LifecycleStatus } from "@/generated/prisma/client";
import { GroupCreateForm } from "@/components/admin/group-create-form";
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

  const [groups, branches, sports, coaches] = await Promise.all([
    prisma.trainingGroup.findMany({
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE }
        }
      },
      orderBy: [{ branchId: "asc" }, { ageMin: "asc" }]
    }),
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: { createdAt: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.coach.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Группы</h1>
        </div>
        <span className="admin-count">{groups.length} групп</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Добавить группу</h2>
        </div>
        <GroupCreateForm
          branches={branches.map((branch) => ({
            id: branch.id,
            name: branch.publicNameRu
          }))}
          sports={sports.map((sport) => ({
            id: sport.id,
            name: sport.nameRu
          }))}
          coaches={coaches.map((coach) => ({
            id: coach.id,
            name: [coach.firstName, coach.lastName].filter(Boolean).join(" ")
          }))}
        />
      </section>

      <div className="admin-group-list">
        {groups.map((group) => (
          <section className="admin-panel admin-editor-panel" key={group.id}>
            <div className="admin-panel-head">
              <div>
                <h2><Link href={"/admin/groups/" + group.id}>{group.internalName}</Link></h2>
                <small>
                  {group.branch.publicNameRu} · {group.sport.nameRu} ·{" "}
                  {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </small>
              </div>
            </div>
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
