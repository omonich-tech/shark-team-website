import Link from "next/link";
import {
  LifecycleStatus,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { GroupCreateForm } from "@/components/admin/group-create-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const weekday: Record<string, string> = {
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

export default async function AdminGroupsPage() {
  const prisma = getPrisma();

  const [groups, branches, sports, coaches] = await Promise.all([
    prisma.trainingGroup.findMany({
      include: {
        branch: true,
        sport: true,
        primaryCoach: true,
        scheduleRules: {
          where: { status: LifecycleStatus.ACTIVE },
          orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }]
        },
        enrollments: {
          where: { status: StudentEnrollmentStatus.ACTIVE },
          select: { id: true }
        }
      },
      orderBy: [
        { status: "asc" },
        { branchId: "asc" },
        { sportId: "asc" },
        { ageMin: "asc" }
      ]
    }),
    prisma.branch.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: { publicNameRu: "asc" }
    }),
    prisma.sport.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }]
    }),
    prisma.coach.findMany({
      where: { status: { not: LifecycleStatus.ARCHIVED } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    })
  ]);

  const active = groups.filter(
    (group) => group.status === LifecycleStatus.ACTIVE
  ).length;
  const open = groups.filter(
    (group) => group.enrollmentStatus === "OPEN"
  ).length;
  const occupied = groups.reduce(
    (sum, group) => sum + group.enrollments.length,
    0
  );
  const capacity = groups.reduce(
    (sum, group) => sum + group.capacityRegular,
    0
  );

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SPORT</p>
          <h1>Группы</h1>
          <p className="admin-page-note">
            Расписание, тренеры, набор, вместимость и жизненный цикл тренировочных групп.
          </p>
        </div>
        <span className="admin-count">{groups.length} групп</span>
      </div>

      <div className="admin-branch-summary">
        <div>
          <span>Активных</span>
          <strong>{active}</strong>
        </div>
        <div>
          <span>Открыт набор</span>
          <strong>{open}</strong>
        </div>
        <div>
          <span>Ученики</span>
          <strong>{occupied}</strong>
        </div>
        <div>
          <span>Места</span>
          <strong>{occupied} / {capacity}</strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Новая группа</p>
            <h2>Создать тренировочную группу</h2>
            <small>
              Draft не создаёт занятия. Active сразу генерирует будущие Sessions по расписанию.
            </small>
          </div>
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
            name: [coach.firstName, coach.lastName]
              .filter(Boolean)
              .join(" ")
          }))}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <p className="admin-panel-kicker">Каталог</p>
            <h2>Все группы</h2>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-group-catalog">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Филиал / спорт</th>
                <th>Тренер</th>
                <th>Возраст</th>
                <th>Ученики</th>
                <th>Расписание</th>
                <th>Набор</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const schedule = group.scheduleRules
                  .map(
                    (rule) =>
                      weekday[rule.weekday] +
                      " " +
                      time(rule.startMinutes)
                  )
                  .join(" · ");

                return (
                  <tr key={group.id}>
                    <td>
                      <strong className="admin-table-primary">
                        {group.internalName}
                      </strong>
                      {group.level ? (
                        <small className="admin-table-secondary">
                          {group.level}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {group.branch.publicNameRu}
                      <br />
                      <small>{group.sport.nameRu}</small>
                    </td>
                    <td>
                      {[group.primaryCoach.firstName, group.primaryCoach.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td>{group.ageMin}–{group.ageMax}</td>
                    <td>
                      {group.enrollments.length} / {group.capacityRegular}
                    </td>
                    <td>{schedule || "—"}</td>
                    <td>
                      <span className="admin-status">
                        {group.enrollmentStatus}
                      </span>
                    </td>
                    <td>
                      <span className="admin-status">{group.status}</span>
                    </td>
                    <td>
                      <Link href={"/admin/groups/" + group.id}>
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {groups.length === 0 ? (
                <tr>
                  <td colSpan={9}>Групп пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
