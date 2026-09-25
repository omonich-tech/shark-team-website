import { notFound } from "next/navigation";
import { TrialAssessmentForm } from "@/components/coach/trial-assessment-form";
import { formatCoachDate } from "@/lib/coach-format";
import { getPrisma } from "@/lib/prisma";
import { requireCoachSession } from "@/server/coach/auth";

export const dynamic = "force-dynamic";

export default async function CoachTrialAssessmentPage({
  params
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const auth = await requireCoachSession();
  const { bookingId } = await params;
  const prisma = getPrisma();

  const booking = await prisma.trialBooking.findFirst({
    where: {
      id: bookingId,
      session: {
        coachId: auth.coachId
      }
    },
    include: {
      lead: true,
      session: {
        include: {
          group: {
            include: {
              branch: true
            }
          }
        }
      },
      attendance: true,
      assessment: true
    }
  });

  if (!booking) {
    notFound();
  }

  const canAssess =
    booking.status === "ATTENDED" &&
    booking.attendance?.status === "PRESENT";

  return (
    <>
      <section className="coach-page-head">
        <p className="eyebrow">ПРОБНОЕ ЗАНЯТИЕ</p>
        <h1>{booking.lead.childName}</h1>
        <p>
          {booking.lead.childAge} лет ·{" "}
          {formatCoachDate(booking.session.startsAt)} ·{" "}
          {booking.session.group.branch.publicNameRu}
        </p>
      </section>

      <section className="coach-trial-summary">
        <div>
          <span>Родитель</span>
          <strong>{booking.lead.parentName}</strong>
          <small>{booking.lead.phone}</small>
        </div>
        <div>
          <span>Группа</span>
          <strong>
            {booking.session.group.ageMin}–{booking.session.group.ageMax} лет
          </strong>
        </div>
        <div>
          <span>Посещаемость</span>
          <strong>{booking.attendance?.status ?? "Не отмечено"}</strong>
        </div>
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Оценка ребёнка</h2>
        </div>

        {canAssess || booking.assessment ? (
          <TrialAssessmentForm
            bookingId={booking.id}
            initialScores={
              booking.assessment
                ? {
                    ability: booking.assessment.ability,
                    discipline: booking.assessment.discipline,
                    motivation: booking.assessment.motivation,
                    coordination: booking.assessment.coordination,
                    physicalPreparation:
                      booking.assessment.physicalPreparation,
                    psychologicalReadiness:
                      booking.assessment.psychologicalReadiness
                  }
                : null
            }
            initialComment={booking.assessment?.coachComment}
            initialRecommendation={booking.assessment?.recommendation}
          />
        ) : (
          <div className="coach-empty">
            Сначала отметьте ребёнка как «Присутствует» на странице занятия.
          </div>
        )}
      </section>
    </>
  );
}
