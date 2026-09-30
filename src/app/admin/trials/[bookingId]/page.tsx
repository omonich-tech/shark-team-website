import Link from "next/link";
import { notFound } from "next/navigation";
import { TrialConversionPanel } from "@/components/admin/trial-conversion-panel";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Пришёл",
  ABSENT: "Не пришёл",
  EXCUSED: "Уважительная"
};

const criteria = [
  ["Способности", "ability"],
  ["Дисциплина", "discipline"],
  ["Мотивация", "motivation"],
  ["Координация", "coordination"],
  ["Физическая подготовка", "physicalPreparation"],
  ["Психологическая готовность", "psychologicalReadiness"]
] as const;

export default async function AdminTrialDetailsPage({
  params
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const prisma = getPrisma();
  const { bookingId } = await params;

  const trial = await prisma.trialBooking.findUnique({
    where: { id: bookingId },
    include: {
      lead: true,
      payment: true,
      attendance: true,
      feedback: true,
      conversion: {
        include: {
          payments: {
            orderBy: { sequence: "desc" },
            take: 1
          }
        }
      },
      assessment: {
        include: {
          coach: true
        }
      },
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

  if (!trial) {
    notFound();
  }

  const group = trial.session.group;
  const coachName = [
    group.primaryCoach.firstName,
    group.primaryCoach.lastName
  ]
    .filter(Boolean)
    .join(" ");

  const assessmentCoach = trial.assessment
    ? [trial.assessment.coach.firstName, trial.assessment.coach.lastName]
        .filter(Boolean)
        .join(" ")
    : null;

  const scores = trial.assessment
    ? criteria.map(([label, key]) => ({
        label,
        value: trial.assessment![key]
      }))
    : [];

  const average =
    scores.length > 0
      ? scores.reduce((sum, item) => sum + item.value, 0) / scores.length
      : null;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">TRIAL DETAILS</p>
          <h1>{trial.lead.childName}</h1>
          <p className="admin-help">
            {trial.lead.childAge} лет · {group.sport.nameRu} ·{" "}
            {group.branch.publicNameRu}
          </p>
        </div>
        <Link className="admin-row-link" href="/admin/trials">
          ← К списку
        </Link>
      </div>

      <section className="admin-detail-grid">
        <article className="admin-detail-card">
          <span>Пробное занятие</span>
          <strong>{formatAdminDate(trial.session.startsAt)}</strong>
          <p>
            Тренер: {coachName || "—"}
            <br />
            Группа: {group.ageMin}–{group.ageMax} лет
          </p>
        </article>

        <article className="admin-detail-card">
          <span>Статус записи</span>
          <strong>{trial.status}</strong>
          <p>
            Подтверждено: {formatAdminDate(trial.confirmedAt)}
            <br />
            HOLD до: {formatAdminDate(trial.expiresAt)}
          </p>
        </article>

        <article className="admin-detail-card">
          <span>Посещаемость</span>
          <strong>
            {trial.attendance
              ? attendanceLabels[trial.attendance.status]
              : "Не отмечено"}
          </strong>
          <p>
            {trial.attendance
              ? "Отмечено " + formatAdminDate(trial.attendance.markedAt)
              : "Тренер ещё не отметил посещение"}
          </p>
        </article>

        <article className="admin-detail-card">
          <span>Оплата</span>
          <strong>
            {trial.payment
              ? formatAdminMoney(trial.payment.amountUzs)
              : "Нет платежа"}
          </strong>
          <p>
            {trial.payment
              ? trial.payment.provider + " · " + trial.payment.status
              : "—"}
          </p>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Родитель и ребёнок</h2>
        </div>
        <div className="admin-info-grid">
          <div>
            <span>Ребёнок</span>
            <strong>{trial.lead.childName}</strong>
            <small>{trial.lead.childAge} лет</small>
          </div>
          <div>
            <span>Родитель</span>
            <strong>{trial.lead.parentName}</strong>
            <small>{trial.lead.phone}</small>
          </div>
          <div>
            <span>Язык</span>
            <strong>{trial.lead.locale.toUpperCase()}</strong>
            <small>Источник: {trial.lead.source}</small>
          </div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Мнение родителя</h2>
          <small>
            {trial.feedback?.completedAt
              ? "Получено " + formatAdminDate(trial.feedback.completedAt)
              : trial.feedback
                ? "Оценка выбрана, ждём комментарий или завершение."
                : trial.status === "ATTENDED"
                  ? "Запрос обратной связи будет отправлен в Telegram."
                  : "Обратная связь доступна после посещения пробного."}
          </small>
        </div>

        {trial.feedback ? (
          <div className="admin-assessment">
            <div className="admin-assessment-score">
              <span>Оценка родителя</span>
              <strong>{trial.feedback.rating} / 5</strong>
            </div>

            <div className="admin-assessment-text">
              <div>
                <span>Комментарий</span>
                <p>
                  {trial.feedback.comment ||
                    (trial.feedback.completedAt
                      ? "Родитель завершил отзыв без комментария."
                      : "Ожидаем комментарий.")}
                </p>
              </div>
              <div>
                <span>Готовность к обработке</span>
                <p>
                  {trial.feedback.completedAt && trial.assessment
                    ? "Готово: есть мнение родителя и оценка тренера."
                    : trial.feedback.completedAt
                      ? "Ждём оценку тренера."
                      : "Ждём завершение отзыва родителя."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-empty-panel">
            Отзыв родителя пока не получен.
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Оценка тренера</h2>
          <small>
            {trial.assessment
              ? "Заполнил: " +
                (assessmentCoach || "тренер") +
                " · " +
                formatAdminDate(trial.assessment.updatedAt)
              : trial.status === "ATTENDED"
                ? "Ребёнок посетил пробное, оценка ещё не заполнена."
                : "Оценка доступна после посещения пробного."}
          </small>
        </div>

        {trial.assessment ? (
          <div className="admin-assessment">
            <div className="admin-assessment-score">
              <span>Средняя оценка</span>
              <strong>{average?.toFixed(1)} / 5</strong>
            </div>

            <div className="admin-score-grid">
              {scores.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value} / 5</strong>
                </div>
              ))}
            </div>

            <div className="admin-assessment-text">
              <div>
                <span>Комментарий тренера</span>
                <p>{trial.assessment.coachComment || "Комментария нет."}</p>
              </div>
              <div>
                <span>Рекомендация</span>
                <p>{trial.assessment.recommendation || "Рекомендации нет."}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-empty-panel">
            Оценка тренера пока не заполнена.
          </div>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Конверсия в постоянного ученика</h2>
          <small>
            Решение администратора → предложение абонемента → оплата → зачисление.
          </small>
        </div>
        <TrialConversionPanel
          bookingId={trial.id}
          ready={Boolean(
            trial.status === "ATTENDED" &&
              trial.feedback?.completedAt &&
              trial.assessment
          )}
          conversion={{
            status: trial.conversion?.status ?? null,
            amountUzs: trial.conversion?.amountUzs ?? null,
            currency: trial.conversion?.currency ?? null,
            paymentStatus: trial.conversion?.payments[0]?.status ?? null
          }}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Платёж</h2>
        </div>

        {trial.payment ? (
          <div className="admin-info-grid">
            <div>
              <span>Статус</span>
              <strong>{trial.payment.status}</strong>
              <small>{trial.payment.provider}</small>
            </div>
            <div>
              <span>Сумма</span>
              <strong>{formatAdminMoney(trial.payment.amountUzs)}</strong>
              <small>{trial.payment.currency}</small>
            </div>
            <div>
              <span>Проверка</span>
              <strong>
                {trial.payment.reviewedAt
                  ? formatAdminDate(trial.payment.reviewedAt)
                  : "Не проверено"}
              </strong>
              <small>
                {trial.payment.rejectionReason
                  ? "Причина: " + trial.payment.rejectionReason
                  : trial.payment.reviewedBy || "—"}
              </small>
            </div>
          </div>
        ) : (
          <div className="admin-empty-panel">Платёж ещё не создан.</div>
        )}
      </section>
    </>
  );
}
