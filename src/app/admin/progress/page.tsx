import { StudentEnrollmentStatus } from "@/generated/prisma/client";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function average(item: {
  ability: number;
  discipline: number;
  motivation: number;
  coordination: number;
  physicalPreparation: number;
  psychologicalReadiness: number;
}) {
  return (
    (item.ability +
      item.discipline +
      item.motivation +
      item.coordination +
      item.physicalPreparation +
      item.psychologicalReadiness) /
    6
  );
}

export default async function AdminProgressPage() {
  const prisma = getPrisma();

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: StudentEnrollmentStatus.ACTIVE
    },
    include: {
      child: {
        include: {
          parent: true,
          progressAssessments: {
            orderBy: { assessedAt: "desc" },
            take: 2
          }
        }
      },
      group: {
        include: {
          branch: true,
          sport: true,
          primaryCoach: true
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 300
  });

  const assessed = enrollments.filter(
    (item) => item.child.progressAssessments.length > 0
  ).length;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">DEVELOPMENT</p>
          <h1>Прогресс</h1>
          <p className="admin-help">
            Регулярные оценки тренера и динамика развития постоянных учеников.
          </p>
        </div>
        <span className="admin-count">
          {assessed} / {enrollments.length} оценены
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Группа</th>
                <th>Тренер</th>
                <th>Последняя оценка</th>
                <th>Динамика</th>
                <th>Дата</th>
                <th>Комментарий</th>
                <th>Рекомендация</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => {
                const latest = enrollment.child.progressAssessments[0];
                const previous = enrollment.child.progressAssessments[1];
                const latestAverage = latest ? average(latest) : null;
                const delta =
                  latest && previous
                    ? average(latest) - average(previous)
                    : null;
                const coach = [
                  enrollment.group.primaryCoach.firstName,
                  enrollment.group.primaryCoach.lastName
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <tr key={enrollment.id}>
                    <td>
                      <strong>{enrollment.child.name}</strong>
                      <br />
                      <small>{enrollment.child.parent.phone}</small>
                    </td>
                    <td>
                      {enrollment.group.internalName}
                      <br />
                      <small>{enrollment.group.sport.nameRu}</small>
                    </td>
                    <td>{coach || "—"}</td>
                    <td>
                      {latestAverage === null
                        ? "—"
                        : latestAverage.toFixed(1) + " / 5"}
                    </td>
                    <td>
                      {delta === null
                        ? "—"
                        : (delta >= 0 ? "+" : "") + delta.toFixed(1)}
                    </td>
                    <td>{latest ? formatAdminDate(latest.assessedAt) : "—"}</td>
                    <td>{latest?.coachComment ?? "—"}</td>
                    <td>{latest?.recommendation ?? "—"}</td>
                  </tr>
                );
              })}
              {enrollments.length === 0 ? (
                <tr><td colSpan={8}>Активных учеников пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
