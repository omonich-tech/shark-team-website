import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceStatus, StudentEnrollmentStatus } from "@/generated/prisma/client";
import { formatAdminDate } from "@/lib/admin-format";
import { getPrisma } from "@/lib/prisma";

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

export default async function AdminChildPage({
  params
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const prisma = getPrisma();
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

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
        where: { trialBookingId: null, session: { startsAt: { gte: since90 } } },
        include: { session: { include: { group: true } } },
        orderBy: { session: { startsAt: "desc" } },
        take: 40
      },
      leads: { orderBy: { createdAt: "asc" }, take: 10 }
    }
  });

  if (!child) notFound();

  const active = child.enrollments.find((item) => item.status === StudentEnrollmentStatus.ACTIVE);
  const present = child.attendances.filter((item) => item.status === AttendanceStatus.PRESENT).length;
  const attendanceRate = child.attendances.length
    ? Math.round((present / child.attendances.length) * 100)
    : null;
  const latestProgress = child.progressAssessments[0];

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">STUDENT 360</p>
          <h1>{child.name}</h1>
          <p className="admin-help">
            {child.ageAtRegistration} лет · {active?.group.sport.nameRu ?? "Без активной секции"}
          </p>
        </div>
        <Link className="admin-status" href="/admin/children">← Все ученики</Link>
      </div>

      <div className="admin-metrics">
        <div className="admin-metric"><span>Статус</span><strong>{active ? "Активен" : "Нет активной группы"}</strong></div>
        <div className="admin-metric"><span>Посещаемость · 90 дней</span><strong>{attendanceRate === null ? "—" : attendanceRate + "%"}</strong></div>
        <div className="admin-metric"><span>Последняя оценка</span><strong>{latestProgress ? avg(latestProgress as unknown as Record<string, unknown>).toFixed(1) + " / 5" : "—"}</strong></div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Профиль и родитель</h2></div>
        <div className="admin-table-wrap"><table className="admin-table"><tbody>
          <tr><th>Ребёнок</th><td>{child.name}</td><th>Дата рождения</th><td>{child.dateOfBirth ? formatAdminDate(child.dateOfBirth) : "—"}</td></tr>
          <tr><th>Родитель</th><td>{child.parent.name}</td><th>Телефон</th><td>{child.parent.phone}</td></tr>
          <tr><th>Язык</th><td>{child.parent.locale.toUpperCase()}</td><th>Telegram</th><td>{child.parent.telegramContacts[0]?.username ? "@" + child.parent.telegramContacts[0].username : child.parent.telegramContacts.length ? "Подключён" : "—"}</td></tr>
        </tbody></table></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Абонементы и группы</h2></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Группа</th><th>Филиал</th><th>Тренер</th><th>Статус</th><th>Период</th><th>Следующая оплата</th></tr></thead>
          <tbody>
            {child.enrollments.map((item) => (
              <tr key={item.id}>
                <td><Link href={"/admin/groups/" + item.groupId}><strong>{item.group.internalName}</strong></Link><br/><small>{item.group.sport.nameRu}</small></td>
                <td>{item.group.branch.publicNameRu}</td>
                <td>{[item.group.primaryCoach.firstName, item.group.primaryCoach.lastName].filter(Boolean).join(" ")}</td>
                <td>{item.status}{item.subscriptionStatus ? " · " + item.subscriptionStatus : ""}</td>
                <td>{item.currentPeriodStart ? formatAdminDate(item.currentPeriodStart) : "—"} — {item.currentPeriodEnd ? formatAdminDate(item.currentPeriodEnd) : "—"}</td>
                <td>{item.nextPaymentDueAt ? formatAdminDate(item.nextPaymentDueAt) : "—"}</td>
              </tr>
            ))}
            {!child.enrollments.length ? <tr><td colSpan={6}>Абонементов пока нет.</td></tr> : null}
          </tbody>
        </table></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Последние посещения</h2></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Дата</th><th>Группа</th><th>Статус</th><th>Причина</th><th>Комментарий</th></tr></thead>
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
            {!child.attendances.length ? <tr><td colSpan={5}>Посещений пока нет.</td></tr> : null}
          </tbody>
        </table></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Динамика развития</h2></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Дата</th><th>Средняя</th>{criteria.map(([,label]) => <th key={label}>{label}</th>)}<th>Комментарий</th><th>Рекомендация</th></tr></thead>
          <tbody>
            {child.progressAssessments.map((item) => (
              <tr key={item.id}>
                <td>{formatAdminDate(item.assessedAt)}</td>
                <td><strong>{avg(item as unknown as Record<string, unknown>).toFixed(1)}</strong></td>
                {criteria.map(([key]) => <td key={key}>{item[key]} / 5</td>)}
                <td>{item.coachComment ?? "—"}</td><td>{item.recommendation ?? "—"}</td>
              </tr>
            ))}
            {!child.progressAssessments.length ? <tr><td colSpan={10}>Оценок пока нет.</td></tr> : null}
          </tbody>
        </table></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head"><h2>История пути</h2></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Дата</th><th>Событие</th><th>Источник / статус</th></tr></thead>
          <tbody>
            {child.leads.map((lead) => <tr key={lead.id}><td>{formatAdminDate(lead.createdAt)}</td><td>Лид / первое обращение</td><td>{lead.source} · {lead.status}</td></tr>)}
            {child.enrollments.map((item) => <tr key={item.id}><td>{formatAdminDate(item.createdAt)}</td><td>Зачисление: {item.group.internalName}</td><td>{item.status}</td></tr>)}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
