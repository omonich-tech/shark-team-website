import { StudentEnrollmentStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireCoachSession } from "@/server/coach/auth";

export const dynamic = "force-dynamic";

export default async function CoachGroupsPage() {
  const auth = await requireCoachSession();
  const prisma = getPrisma();

  const groups = await prisma.trainingGroup.findMany({
    where: {
      primaryCoachId: auth.coachId,
      status: "ACTIVE"
    },
    include: {
      branch: true,
      sport: true,
      enrollments: {
        where: {
          status: StudentEnrollmentStatus.ACTIVE
        },
        include: {
          child: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      ageMin: "asc"
    }
  });

  return (
    <>
      <section className="coach-page-head">
        <p className="eyebrow">ГРУППЫ</p>
        <h1>Мои группы</h1>
      </section>

      <div className="coach-group-grid">
        {groups.map((group) => (
          <article className="coach-group-card" key={group.id}>
            <span>{group.sport.nameRu}</span>
            <h2>
              {group.ageMin}–{group.ageMax} лет
            </h2>
            <p>{group.branch.publicNameRu}</p>
            <strong>
              {group.enrollments.length} / {group.capacityRegular}
            </strong>

            {group.enrollments.length > 0 ? (
              <div className="coach-group-students">
                {group.enrollments.map((enrollment) => (
                  <span key={enrollment.id}>{enrollment.child.name}</span>
                ))}
              </div>
            ) : (
              <small>Активных зачислений пока нет.</small>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
