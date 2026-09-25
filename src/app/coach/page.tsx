import Link from "next/link";
import { TrialBookingStatus } from "@/generated/prisma/client";
import { formatCoachDate, formatCoachTime } from "@/lib/coach-format";
import { dayRangeInTimeZone } from "@/lib/timezone";
import { getPrisma } from "@/lib/prisma";
import { requireCoachSession } from "@/server/coach/auth";

export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const auth = await requireCoachSession();
  const prisma = getPrisma();
  const now = new Date();
  const today = dayRangeInTimeZone(now, "Asia/Tashkent");

  const [todaySessions, upcomingSessions, pendingAssessments] =
    await Promise.all([
      prisma.trainingSession.findMany({
        where: {
          coachId: auth.coachId,
          startsAt: {
            gte: today.start,
            lt: today.end
          }
        },
        include: {
          group: {
            include: {
              branch: true
            }
          },
          _count: {
            select: {
              attendances: true,
              trialBookings: true
            }
          }
        },
        orderBy: {
          startsAt: "asc"
        }
      }),
      prisma.trainingSession.findMany({
        where: {
          coachId: auth.coachId,
          startsAt: {
            gt: now
          }
        },
        include: {
          group: {
            include: {
              branch: true
            }
          }
        },
        orderBy: {
          startsAt: "asc"
        },
        take: 8
      }),
      prisma.trialBooking.findMany({
        where: {
          status: TrialBookingStatus.ATTENDED,
          assessment: null,
          session: {
            coachId: auth.coachId
          }
        },
        include: {
          lead: true,
          session: true
        },
        orderBy: {
          updatedAt: "asc"
        },
        take: 10
      })
    ]);

  return (
    <>
      <section className="coach-page-head">
        <p className="eyebrow">SHARK TEAM COACH</p>
        <h1>Сегодня</h1>
        <p>{today.dateKey}</p>
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Занятия сегодня</h2>
          <span>{todaySessions.length}</span>
        </div>

        <div className="coach-session-grid">
          {todaySessions.map((session) => (
            <Link
              className="coach-session-card"
              href={`/coach/sessions/${session.id}`}
              key={session.id}
            >
              <span className="coach-session-time">
                {formatCoachTime(session.startsAt)}–
                {formatCoachTime(session.endsAt)}
              </span>
              <strong>
                {session.group.ageMin}–{session.group.ageMax} лет
              </strong>
              <p>{session.group.branch.publicNameRu}</p>
              <small>
                Отмечено: {session._count.attendances} · Пробных:{" "}
                {session._count.trialBookings}
              </small>
            </Link>
          ))}

          {todaySessions.length === 0 ? (
            <div className="coach-empty">Сегодня занятий нет.</div>
          ) : null}
        </div>
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Ближайшие занятия</h2>
        </div>

        <div className="coach-list">
          {upcomingSessions.map((session) => (
            <Link
              href={`/coach/sessions/${session.id}`}
              className="coach-list-row"
              key={session.id}
            >
              <span>{formatCoachDate(session.startsAt)}</span>
              <strong>
                {session.group.ageMin}–{session.group.ageMax} лет
              </strong>
              <span>{session.group.branch.publicNameRu}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="coach-section">
        <div className="coach-section-head">
          <h2>Нужно оценить после пробного</h2>
          <span>{pendingAssessments.length}</span>
        </div>

        <div className="coach-list">
          {pendingAssessments.map((booking) => (
            <Link
              className="coach-list-row"
              href={`/coach/trials/${booking.id}`}
              key={booking.id}
            >
              <span>{booking.lead.childName}</span>
              <strong>{booking.lead.childAge} лет</strong>
              <span>{formatCoachDate(booking.session.startsAt)}</span>
            </Link>
          ))}

          {pendingAssessments.length === 0 ? (
            <div className="coach-empty">Нет незаполненных оценок.</div>
          ) : null}
        </div>
      </section>
    </>
  );
}
