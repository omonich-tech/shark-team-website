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
      }
    }
  });

  const active = enrollments.filter(
    (item) => item.status === "ACTIVE"
  ).length;
  const frozen = enrollments.filter(
    (item) => item.subscriptionStatus === "FROZEN"
  ).length;
  const paymentIssues = enrollments.filter(
    (item) =>
      item.subscriptionStatus === "PAYMENT_DUE" ||
      item.subscriptionStatus === "PAST_DUE" ||
      item.subscriptionStatus === "PAUSED"
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
          <span>Требуют оплаты</span>
          <strong>{paymentIssues}</strong>
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
                  <h2>{enrollment.child.name}</h2>
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
                  <span>Заморозка</span>
                  <strong>
                    {enrollment.subscriptionStatus === "FROZEN"
                      ? "до " + formatAdminDate(enrollment.freezeUntil)
                      : "—"}
                  </strong>
                </div>
              </div>

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
