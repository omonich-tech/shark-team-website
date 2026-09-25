import { notFound } from "next/navigation";
import { AttendancePanel } from "@/components/coach/attendance-panel";
import { formatCoachDate } from "@/lib/coach-format";
import { requireCoachSession } from "@/server/coach/auth";
import { getCoachSessionParticipants } from "@/server/coach/get-session-participants";

export const dynamic = "force-dynamic";

export default async function CoachSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const auth = await requireCoachSession();
  const { sessionId } = await params;

  const data = await getCoachSessionParticipants(auth.coachId, sessionId);

  if (!data) {
    notFound();
  }

  return (
    <>
      <section className="coach-page-head">
        <p className="eyebrow">ЗАНЯТИЕ</p>
        <h1>
          {data.session.groupAgeMin}–{data.session.groupAgeMax} лет
        </h1>
        <p>
          {formatCoachDate(data.session.startsAt)} ·{" "}
          {data.session.branchName}
        </p>
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Посещаемость</h2>
          <span>{data.participants.length}</span>
        </div>

        <AttendancePanel
          sessionId={data.session.id}
          initialParticipants={data.participants}
        />
      </section>
    </>
  );
}
