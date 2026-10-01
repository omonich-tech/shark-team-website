import Link from "next/link";
import {
  OperationalAlertStatus,
  OperationalAlertType
} from "@/generated/prisma/client";
import { SubscriptionControls } from "@/components/admin/subscription-controls";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const prisma = getPrisma();

  const enrollments = await prisma.studentEnrollment.findMany({
    take: 300,
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" }
    ],
    include: {
      child: {
        include: {
          parent: true
        }
      },
      group: {
        include: {
          branch: true,
          sport: true,
          primaryCoach: true
        }
      },
      payments: {
        orderBy: {
          sequence: "desc"
        },
        take: 2
      },
      operationalAlerts: {
        where: {
          type: OperationalAlertType.PAYMENT_ATTENTION,
          status: OperationalAlertStatus.OPEN
        },
        take: 1
      }
    }
  });

  const active = enrollments.filter(
    (item) => item.status === "ACTIVE"
  ).length;
  const frozen = enrollments.filter(
    (item) => item.subscriptionStatus === "FROZEN"
  ).length;
  const paymentDue = enrollments.filter(
    (item) => item.subscriptionStatus === "PAYMENT_DUE"
  ).length;
  const pastDue = enrollments.filter(
    (item) => item.subscriptionStatus === "PAST_DUE"
  ).length;
  const pausedForPayment = enrollments.filter(
    (item) => item.subscriptionStatus === "PAUSED"
  ).length;
  const underReview = enrollments.filter((item) =>
    item.payments.some((payment) => payment.status === "UNDER_REVIEW")
  ).length;
  const paymentIssues = enrollments.filter(
    (item) => item.operationalAlerts.length > 0
  ).length;

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">BILLING</p>
          <h1>Абонементы</h1>
          <p className="admin-help">
            Продление, ручная заморозка, возобновление и прекращение.
          </p>
        </div>
        <span className="admin-count">{enrollments.length} записей</span>
      </div>

      <section className="admin-metrics">
        <div className="admin-metric">
          <span>Активные места</span>
          <strong>{active}</strong>
        </div>
        <div className="admin-metric">
          <span>Ручная заморозка</span>
          <strong>{frozen}</strong>
        </div>
        <div className="admin-metric">
          <span>Требуют внимания</span>
          <strong>{paymentIssues}</strong>
        </div>
        <div className="admin-metric">
          <span>Срок оплаты</span>
          <strong>{paymentDue}</strong>
        </div>
        <div className="admin-metric">
          <span>Просрочено</span>
          <strong>{pastDue}</strong>
        </div>
        <div className="admin-metric">
          <span>Приостановлено</span>
          <strong>{pausedForPayment}</strong>
        </div>
        <div className="admin-metric">
          <span>Оплата на проверке</span>
          <strong>{underReview}</strong>
        </div>
      </section>

      <div className="subscription-admin-list">
        {enrollments.map((enrollment) => {
          const latestPayment = enrollment.payments[0];
          const coachName = [
            enrollment.group.primaryCoach.firstName,
            enrollment.group.primaryCoach.lastName
          ]
            .filter(Boolean)
            .join(" ");
          const paymentUnderReview = enrollment.payments.some(
            (payment) => payment.status === "UNDER_REVIEW"
          );

          return (
            <section className="admin-panel" key={enrollment.id}>
              <div className="subscription-admin-head">
                <div>
                  <span className="admin-status">
                    {enrollment.subscriptionStatus ?? enrollment.status}
                  </span>
                  <h2>
                    <Link href={"/admin/children/" + enrollment.childId}>
                      {enrollment.child.name}
                    </Link>
                  </h2>
                  <p>
                    {enrollment.group.sport.nameRu} ·{" "}
                    {enrollment.group.internalName} ·{" "}
                    {enrollment.group.branch.publicNameRu}
                  </p>
                  <small>
                    Родитель: {enrollment.child.parent.name} ·{" "}
                    {enrollment.child.parent.phone} · Тренер:{" "}
                    {coachName || "—"}
                  </small>
                </div>
              </div>

              <div className="subscription-summary-grid">
                <div>
                  <span>Оплачено до</span>
                  <strong>
                    {formatAdminDate(enrollment.currentPeriodEnd)}
                  </strong>
                </div>
                <div>
                  <span>Следующая оплата</span>
                  <strong>
                    {formatAdminDate(enrollment.nextPaymentDueAt)}
                  </strong>
                </div>
                <div>
                  <span>Последний платёж</span>
                  <strong>
                    {latestPayment
                      ? latestPayment.status + " · №" + latestPayment.sequence
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>Льготный период</span>
                  <strong>
                    {enrollment.graceUntil
                      ? "до " + formatAdminDate(enrollment.graceUntil)
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>Заморозка</span>
                  <strong>
                    {enrollment.subscriptionStatus === "FROZEN"
                      ? "до " + formatAdminDate(enrollment.freezeUntil)
                      : "—"}
                  </strong>
                </div>
              </div>

              {enrollment.operationalAlerts[0] ? (
                <div className="subscription-note">
                  <strong>
                    {enrollment.operationalAlerts[0].severity === "critical"
                      ? "Критический платёжный сигнал"
                      : "Требует оплаты"}
                  </strong>
                  {" · "}
                  {enrollment.operationalAlerts[0].details ?? "Требуется действие администратора"}
                </div>
              ) : null}

              {enrollment.freezeReason ? (
                <div className="subscription-note">
                  Причина заморозки: {enrollment.freezeReason}
                </div>
              ) : null}

              {enrollment.endReason ? (
                <div className="subscription-note">
                  Причина прекращения: {enrollment.endReason}
                </div>
              ) : null}

              <SubscriptionControls
                enrollmentId={enrollment.id}
                subscription={{
                  status: enrollment.subscriptionStatus ?? enrollment.status,
                  enrollmentStatus: enrollment.status,
                  paymentUnderReview
                }}
              />
            </section>
          );
        })}

        {enrollments.length === 0 ? (
          <section className="admin-panel">
            <div className="admin-empty-panel">
              Постоянных абонементов пока нет.
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
