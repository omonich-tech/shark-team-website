import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AttendanceStatus,
  StudentEnrollmentStatus
} from "@/generated/prisma/client";
import { EnrollmentAdminActions } from "@/components/admin/enrollment-admin-actions";
import { StudentNoteForm } from "@/components/admin/student-note-form";
import { StudentProfileEditor } from "@/components/admin/student-profile-editor";
import { SubscriptionControls } from "@/components/admin/subscription-controls";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";
import { findSubscriptionPrice } from "@/server/billing/subscription-price";

export const dynamic = "force-dynamic";

const criteria = [
  ["ability", "Навыки"],
  ["discipline", "Дисциплина"],
  ["motivation", "Мотивация"],
  ["coordination", "Координация"],
  ["physicalPreparation", "Физподготовка"],
  ["psychologicalReadiness", "Психологическая готовность"]
] as const;

function avg(item: Record<string, unknown>) {
  const values = criteria.map(([key]) => Number(item[key] ?? 0));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

const auditLabels: Record<string, string> = {
  UPDATE_STUDENT_PROFILE: "Обновлён профиль ученика",
  ADD_STUDENT_NOTE: "Добавлена внутренняя заметка",
  TRANSFER_STUDENT_GROUP: "Перевод между группами",
  RECORD_MANUAL_SUBSCRIPTION_PAYMENT: "Вручную зафиксирована оплата",
  FREEZE_SUBSCRIPTION: "Абонемент заморожен",
  RESUME_SUBSCRIPTION: "Абонемент возобновлён",
  END_SUBSCRIPTION: "Абонемент завершён"
};

export default async function AdminChildPage({
  params
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const prisma = getPrisma();
  const now = new Date();
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: {
      parent: { include: { telegramContacts: true } },
      enrollments: {
        include: {
          group: { include: { branch: true, sport: true, primaryCoach: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 8 }
        },
        orderBy: { createdAt: "desc" }
      },
      progressAssessments: { orderBy: { assessedAt: "desc" }, take: 12 },
      attendances: {
        where: {
          trialBookingId: null,
          session: { startsAt: { gte: since90 } }
        },
        include: { session: { include: { group: true } } },
        orderBy: { session: { startsAt: "desc" } },
        take: 40
      },
      leads: { orderBy: { createdAt: "asc" }, take: 10 },
      adminNotes: { orderBy: { createdAt: "desc" }, take: 30 }
    }
  });

  if (!child) notFound();

  const enrollmentIds = child.enrollments.map((item) => item.id);

  const [groups, auditLogs, priceEntries] = await Promise.all([
    prisma.trainingGroup.findMany({
      where: { status: "ACTIVE" },
      include: {
        branch: true,
        sport: true,
        _count: {
          select: {
            enrollments: {
              where: { status: StudentEnrollmentStatus.ACTIVE }
            }
          }
        }
      },
      orderBy: [{ branchId: "asc" }, { ageMin: "asc" }]
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "Child", entityId: child.id },
          ...(enrollmentIds.length
            ? [{ entityType: "StudentEnrollment", entityId: { in: enrollmentIds } }]
            : [])
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    Promise.all(
      child.enrollments.map(async (item) => ({
        enrollmentId: item.id,
        price: await findSubscriptionPrice(item.groupId, now)
      }))
    )
  ]);

  const prices = new Map(
    priceEntries.map((entry) => [entry.enrollmentId, entry.price?.amount ?? null])
  );
  const active = child.enrollments.find(
    (item) => item.status === StudentEnrollmentStatus.ACTIVE
  );
  const present = child.attendances.filter(
    (item) => item.status === AttendanceStatus.PRESENT
  ).length;
  const attendanceRate = child.attendances.length
    ? Math.round((present / child.attendances.length) * 100)
    : null;
  const latestProgress = child.progressAssessments[0];

  const groupOptions = groups.map((group) => ({
    id: group.id,
    name: group.internalName,
    branch: group.branch.publicNameRu,
    sport: group.sport.nameRu,
    free: Math.max(0, group.capacityRegular - group._count.enrollments)
  }));

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">STUDENT 360</p>
          <h1>{child.name}</h1>
          <p className="admin-help">
            {child.ageAtRegistration} лет ·{" "}
            {active?.group.sport.nameRu ?? "Без активной секции"}
          </p>
        </div>
        <Link className="admin-status" href="/admin/children">
          ← Все ученики
        </Link>
      </div>

      <div className="admin-metrics">
        <div className="admin-metric">
          <span>Статус</span>
          <strong>{active ? "Активен" : "Нет активной группы"}</strong>
        </div>
        <div className="admin-metric">
          <span>Посещаемость · 90 дней</span>
          <strong>{attendanceRate === null ? "—" : attendanceRate + "%"}</strong>
        </div>
        <div className="admin-metric">
          <span>Последняя оценка</span>
          <strong>
            {latestProgress
              ? avg(
                  latestProgress as unknown as Record<string, unknown>
                ).toFixed(1) + " / 5"
              : "—"}
          </strong>
        </div>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Профиль и родитель</h2>
          <p className="admin-help">
            Изменение данных родителя применяется ко всем его детям в CRM.
          </p>
        </div>
        <StudentProfileEditor
          child={{
            id: child.id,
            name: child.name,
            ageAtRegistration: child.ageAtRegistration,
            dateOfBirth: dateInput(child.dateOfBirth),
            parentName: child.parent.name,
            parentPhone: child.parent.phone,
            locale: child.parent.locale
          }}
        />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Telegram</th>
                <td>
                  {child.parent.telegramContacts[0]?.username
                    ? "@" + child.parent.telegramContacts[0].username
                    : child.parent.telegramContacts.length
                      ? "Подключён"
                      : "—"}
                </td>
                <th>Карточка создана</th>
                <td>{formatAdminDate(child.createdAt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Абонементы и группы</h2>
        </div>
        {child.enrollments.map((item) => {
          const paymentUnderReview = item.payments.some(
            (payment) => payment.status === "UNDER_REVIEW"
          );
          const latestPayment = item.payments[0];

          return (
            <div className="student-enrollment-block" key={item.id}>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <tbody>
                    <tr>
                      <th>Группа</th>
                      <td>
                        <Link href={"/admin/groups/" + item.groupId}>
                          <strong>{item.group.internalName}</strong>
                        </Link>
                        <br />
                        <small>{item.group.sport.nameRu}</small>
                      </td>
                      <th>Филиал</th>
                      <td>{item.group.branch.publicNameRu}</td>
                    </tr>
                    <tr>
                      <th>Тренер</th>
                      <td>
                        {[
                          item.group.primaryCoach.firstName,
                          item.group.primaryCoach.lastName
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      </td>
                      <th>Статус</th>
                      <td>
                        {item.status}
                        {item.subscriptionStatus
                          ? " · " + item.subscriptionStatus
                          : ""}
                      </td>
                    </tr>
                    <tr>
                      <th>Оплаченный период</th>
                      <td>
                        {item.currentPeriodStart
                          ? formatAdminDate(item.currentPeriodStart)
                          : "—"}{" "}
                        —{" "}
                        {item.currentPeriodEnd
                          ? formatAdminDate(item.currentPeriodEnd)
                          : "—"}
                      </td>
                      <th>Следующая оплата</th>
                      <td>
                        {item.nextPaymentDueAt
                          ? formatAdminDate(item.nextPaymentDueAt)
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <th>Последний платёж</th>
                      <td>
                        {latestPayment
                          ? latestPayment.status +
                            " · " +
                            formatAdminMoney(latestPayment.amountUzs)
                          : "—"}
                      </td>
                      <th>Начало обучения</th>
                      <td>{formatAdminDate(item.startDate)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <EnrollmentAdminActions
                enrollmentId={item.id}
                currentGroupId={item.groupId}
                ended={item.status === StudentEnrollmentStatus.ENDED}
                groups={groupOptions}
                suggestedAmount={prices.get(item.id) ?? null}
              />

              <div className="student-subscription-actions">
                <SubscriptionControls
                  enrollmentId={item.id}
                  subscription={{
                    status: item.subscriptionStatus ?? item.status,
                    enrollmentStatus: item.status,
                    paymentUnderReview
                  }}
                />
              </div>
            </div>
          );
        })}
        {!child.enrollments.length ? (
          <div className="admin-empty-panel">Абонементов пока нет.</div>
        ) : null}
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Внутренние заметки</h2>
        </div>
        <StudentNoteForm childId={child.id} />
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Администратор</th>
                <th>Заметка</th>
              </tr>
            </thead>
            <tbody>
              {child.adminNotes.map((note) => (
                <tr key={note.id}>
                  <td>{formatAdminDate(note.createdAt)}</td>
                  <td>{note.authorId ?? "—"}</td>
                  <td className="admin-wrap-cell">{note.note}</td>
                </tr>
              ))}
              {!child.adminNotes.length ? (
                <tr>
                  <td colSpan={3}>Внутренних заметок пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Последние посещения</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Группа</th>
                <th>Статус</th>
                <th>Причина</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {child.attendances.slice(0, 15).map((item) => (
                <tr key={item.id}>
                  <td>{formatAdminDate(item.session.startsAt)}</td>
                  <td>{item.session.group.internalName}</td>
                  <td>{item.status}</td>
                  <td>{item.absenceReason ?? "—"}</td>
                  <td>{item.absenceNote ?? "—"}</td>
                </tr>
              ))}
              {!child.attendances.length ? (
                <tr>
                  <td colSpan={5}>Посещений пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Динамика развития</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Средняя</th>
                {criteria.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
                <th>Комментарий</th>
                <th>Рекомендация</th>
              </tr>
            </thead>
            <tbody>
              {child.progressAssessments.map((item) => (
                <tr key={item.id}>
                  <td>{formatAdminDate(item.assessedAt)}</td>
                  <td>
                    <strong>
                      {avg(
                        item as unknown as Record<string, unknown>
                      ).toFixed(1)}
                    </strong>
                  </td>
                  {criteria.map(([key]) => (
                    <td key={key}>{item[key]} / 5</td>
                  ))}
                  <td>{item.coachComment ?? "—"}</td>
                  <td>{item.recommendation ?? "—"}</td>
                </tr>
              ))}
              {!child.progressAssessments.length ? (
                <tr>
                  <td colSpan={10}>Оценок пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>История действий</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Событие</th>
                <th>Кто / источник</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatAdminDate(log.createdAt)}</td>
                  <td>{auditLabels[log.action] ?? log.action}</td>
                  <td>{log.actorId ?? log.actorType}</td>
                </tr>
              ))}
              {child.leads.map((lead) => (
                <tr key={"lead-" + lead.id}>
                  <td>{formatAdminDate(lead.createdAt)}</td>
                  <td>Лид / первое обращение</td>
                  <td>{lead.source} · {lead.status}</td>
                </tr>
              ))}
              {child.enrollments.map((item) => (
                <tr key={"enrollment-" + item.id}>
                  <td>{formatAdminDate(item.createdAt)}</td>
                  <td>Зачисление: {item.group.internalName}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
