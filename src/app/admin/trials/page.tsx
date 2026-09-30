import Link from "next/link";
import {
  TrialBookingStatus,
  type AttendanceStatus
} from "@/generated/prisma/client";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const trialStatusLabels: Record<TrialBookingStatus, string> = {
  HOLD: "Бронь",
  PAYMENT_PENDING: "Чек на проверке",
  CONFIRMED: "Подтверждено",
  EXPIRED: "Истекло",
  CANCELLED: "Отменено",
  ATTENDED: "Пришёл",
  NO_SHOW: "Не пришёл"
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Пришёл",
  ABSENT: "Не пришёл",
  EXCUSED: "Уважительная"
};

function averageScore(
  assessment:
    | {
        ability: number;
        discipline: number;
        motivation: number;
        coordination: number;
        physicalPreparation: number;
        psychologicalReadiness: number;
      }
    | null
) {
  if (!assessment) return null;

  const scores = [
    assessment.ability,
    assessment.discipline,
    assessment.motivation,
    assessment.coordination,
    assessment.physicalPreparation,
    assessment.psychologicalReadiness
  ];

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export default async function AdminTrialsPage() {
  const prisma = getPrisma();

  const trials = await prisma.trialBooking.findMany({
    take: 200,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      lead: true,
      payment: true,
      attendance: true,
      assessment: true,
      feedback: true,
      session: {
        include: {
          group: {
            include: {
              branch: true,
              sport: true,
              primaryCoach: true
            }
          }
        }
      }
    }
  });

  const confirmed = trials.filter(
    (trial) =>
      trial.status === TrialBookingStatus.CONFIRMED ||
      trial.status === TrialBookingStatus.ATTENDED ||
      trial.status === TrialBookingStatus.NO_SHOW
  ).length;
  const attended = trials.filter(
    (trial) => trial.status === TrialBookingStatus.ATTENDED
  ).length;
  const readyForAdmin = trials.filter(
    (trial) =>
      Boolean(trial.assessment) && Boolean(trial.feedback?.completedAt)
  ).length;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">TRIALS</p>
          <h1>Пробные занятия</h1>
        </div>
        <span className="admin-count">{trials.length} записей</span>
      </div>

      <section className="admin-metrics">
        <div className="admin-metric">
          <span>Подтверждено</span>
          <strong>{confirmed}</strong>
        </div>
        <div className="admin-metric">
          <span>Посетили</span>
          <strong>{attended}</strong>
        </div>
        <div className="admin-metric">
          <span>Готовы к обработке</span>
          <strong>{readyForAdmin}</strong>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Операционный список</h2>
          <small>
            Оплата, посещаемость, оценка тренера и мнение родителя в одной таблице.
          </small>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Ребёнок</th>
                <th>Пробное</th>
                <th>Тренер</th>
                <th>Оплата</th>
                <th>Посещение</th>
                <th>Тренер</th>
                <th>Родитель</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trials.map((trial) => {
                const group = trial.session.group;
                const coachName = [
                  group.primaryCoach.firstName,
                  group.primaryCoach.lastName
                ]
                  .filter(Boolean)
                  .join(" ");
                const score = averageScore(trial.assessment);

                return (
                  <tr key={trial.id}>
                    <td>
                      <span className="admin-status">
                        {trialStatusLabels[trial.status]}
                      </span>
                    </td>
                    <td>
                      <strong>{trial.lead.childName}</strong>
                      <br />
                      {trial.lead.childAge} лет
                      <br />
                      <small>{trial.lead.parentName} · {trial.lead.phone}</small>
                    </td>
                    <td>
                      {formatAdminDate(trial.session.startsAt)}
                      <br />
                      <small>
                        {group.sport.nameRu} · {group.branch.publicNameRu}
                      </small>
                    </td>
                    <td>{coachName || "—"}</td>
                    <td>
                      {trial.payment
                        ? trial.payment.status +
                          " · " +
                          formatAdminMoney(trial.payment.amountUzs)
                        : "—"}
                    </td>
                    <td>
                      {trial.attendance
                        ? attendanceLabels[trial.attendance.status]
                        : "Не отмечено"}
                    </td>
                    <td>
                      {score !== null ? (
                        <>
                          <strong>{score.toFixed(1)} / 5</strong>
                          <br />
                          <small>оценка заполнена</small>
                        </>
                      ) : trial.status === TrialBookingStatus.ATTENDED ? (
                        <span className="admin-attention">Нужно заполнить</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {trial.feedback?.completedAt ? (
                        <>
                          <strong>{trial.feedback.rating} / 5</strong>
                          <br />
                          <small>
                            {trial.feedback.comment
                              ? "есть комментарий"
                              : "без комментария"}
                          </small>
                        </>
                      ) : trial.status === TrialBookingStatus.ATTENDED ? (
                        <span className="admin-attention">Ждём отзыв</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Link
                        className="admin-row-link"
                        href={"/admin/trials/" + trial.id}
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {trials.length === 0 ? (
                <tr>
                  <td colSpan={9}>Пробных записей пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
