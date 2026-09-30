import { notFound } from "next/navigation";
import {
  AttendanceStatus,
  StudentEnrollmentStatus,
  SubscriptionStatus
} from "@/generated/prisma/client";
import { ProgressAssessmentForm } from "@/components/coach/progress-assessment-form";
import { ProgressTrendChart } from "@/components/coach/progress-trend-chart";
import { formatCoachDate } from "@/lib/coach-format";
import { getPrisma } from "@/lib/prisma";
import { requireCoachSession } from "@/server/coach/auth";

export const dynamic = "force-dynamic";

const criteria = [
  ["ability", "Навыки"],
  ["discipline", "Дисциплина"],
  ["motivation", "Мотивация"],
  ["coordination", "Координация"],
  ["physicalPreparation", "Физподготовка"],
  ["psychologicalReadiness", "Психологическая готовность"]
] as const;

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

export default async function CoachStudentProgressPage({
  params
}: {
  params: Promise<{ childId: string }>;
}) {
  const auth = await requireCoachSession();
  const { childId } = await params;
  const prisma = getPrisma();
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      childId,
      status: StudentEnrollmentStatus.ACTIVE,
      group: { primaryCoachId: auth.coachId },
      OR: [
        { subscriptionStatus: null },
        {
          subscriptionStatus: {
            notIn: [
              SubscriptionStatus.FROZEN,
              SubscriptionStatus.PAUSED,
              SubscriptionStatus.ENDED
            ]
          }
        }
      ]
    },
    include: {
      child: { include: { parent: true } },
      group: { include: { branch: true, sport: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!enrollment) notFound();

  const [history, baseline, attendance] = await Promise.all([
    prisma.studentProgressAssessment.findMany({
      where: {
        childId,
        groupId: enrollment.groupId
      },
      orderBy: { assessedAt: "desc" },
      take: 12
    }),
    prisma.trialAssessment.findFirst({
      where: {
        trialBooking: {
          lead: { childId }
        }
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.attendance.findMany({
      where: {
        childId,
        trialBookingId: null,
        session: {
          groupId: enrollment.groupId,
          startsAt: { gte: since90 }
        }
      },
      orderBy: { markedAt: "desc" }
    })
  ]);

  const present = attendance.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const attendanceRate =
    attendance.length > 0
      ? Math.round((present / attendance.length) * 100)
      : null;
  const latest = history[0];

  return (
    <>
      <section className="coach-page-head">
        <p className="eyebrow">РАЗВИТИЕ УЧЕНИКА</p>
        <h1>{enrollment.child.name}</h1>
        <p>
          {enrollment.group.sport.nameRu} · {enrollment.group.internalName} ·{" "}
          {enrollment.group.branch.publicNameRu}
        </p>
      </section>

      <section className="coach-section">
        <div className="progress-overview">
          <div>
            <span>Посещаемость · 90 дней</span>
            <strong>{attendanceRate === null ? "—" : attendanceRate + "%"}</strong>
          </div>
          <div>
            <span>Последняя оценка</span>
            <strong>{latest ? average(latest).toFixed(1) + " / 5" : "—"}</strong>
          </div>
          <div>
            <span>Оценок развития</span>
            <strong>{history.length}</strong>
          </div>
          <div>
            <span>Родитель</span>
            <strong>{enrollment.child.parent.name}</strong>
          </div>
        </div>
      </section>

      {baseline ? (
        <section className="coach-section">
          <div className="coach-section-head">
            <h2>Стартовая оценка с пробного</h2>
          </div>
          <div className="progress-score-grid">
            {criteria.map(([key, label]) => (
              <div className="progress-score-card" key={key}>
                <span>{label}</span>
                <strong>{baseline[key]} / 5</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Динамика · пробное → М1 → М2 → М3</h2>
        </div>
        <ProgressTrendChart
          baseline={
            baseline
              ? {
                  ability: baseline.ability,
                  discipline: baseline.discipline,
                  motivation: baseline.motivation,
                  coordination: baseline.coordination,
                  physicalPreparation: baseline.physicalPreparation,
                  psychologicalReadiness: baseline.psychologicalReadiness
                }
              : null
          }
          assessments={history.map((item) => ({
            assessedAt: item.assessedAt,
            ability: item.ability,
            discipline: item.discipline,
            motivation: item.motivation,
            coordination: item.coordination,
            physicalPreparation: item.physicalPreparation,
            psychologicalReadiness: item.psychologicalReadiness
          }))}
        />
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Новая оценка</h2>
        </div>
        <ProgressAssessmentForm childId={childId} />
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Динамика</h2>
          <span>{history.length}</span>
        </div>

        <div className="progress-history">
          {history.map((item, index) => {
            const prior = history[index + 1];
            const delta = prior ? average(item) - average(prior) : null;

            return (
              <article className="progress-history-card" key={item.id}>
                <header>
                  <strong>{formatCoachDate(item.assessedAt)}</strong>
                  <span
                    className={
                      delta === null
                        ? undefined
                        : delta >= 0
                          ? "progress-delta-up"
                          : "progress-delta-down"
                    }
                  >
                    {delta === null
                      ? "Первая точка"
                      : (delta >= 0 ? "+" : "") + delta.toFixed(1)}
                  </span>
                </header>

                <div className="progress-score-grid">
                  {criteria.map(([key, label]) => (
                    <div className="progress-score-card" key={key}>
                      <span>{label}</span>
                      <strong>{item[key]} / 5</strong>
                    </div>
                  ))}
                </div>

                {item.coachComment ? (
                  <p>Комментарий: {item.coachComment}</p>
                ) : null}
                {item.recommendation ? (
                  <p>Рекомендация: {item.recommendation}</p>
                ) : null}
              </article>
            );
          })}

          {history.length === 0 ? (
            <div className="coach-empty">
              Регулярных оценок развития пока нет.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
