import Link from "next/link";
import { formatAdminDate } from "@/lib/admin-format";
import { buildOperationsAssistantBrief } from "@/server/assistant/operations-brief";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  payment: "Оплата",
  attendance: "Посещаемость",
  progress: "Прогресс",
  lead: "Лид",
  trial: "Пробное",
  capacity: "Группа"
};

const priorityLabels: Record<string, string> = {
  critical: "Критический",
  high: "Высокий",
  normal: "Плановый"
};

export default async function AdminAssistantPage() {
  const brief = await buildOperationsAssistantBrief();

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SHARK TEAM · ASSISTANT</p>
          <h1>AI-ассистент · Операционный бриф</h1>
          <p className="admin-help">
            Автоматический разбор фактов CRM. Приоритеты строятся только по
            реальным статусам, оплатам, посещаемости, прогрессу и загрузке групп.
          </p>
        </div>
        <div className="admin-status">
          Обновлено: {formatAdminDate(brief.generatedAt)}
        </div>
      </div>

      <section className="admin-panel">
        <div className="assistant-headline">
          <span>Сейчас</span>
          <strong>{brief.headline}</strong>
        </div>
      </section>

      <section className="admin-metrics">
        <article className="admin-metric">
          <span>Критические</span>
          <strong>{brief.counts.critical}</strong>
        </article>
        <article className="admin-metric">
          <span>Высокий приоритет</span>
          <strong>{brief.counts.high}</strong>
        </article>
        <article className="admin-metric">
          <span>Плановые</span>
          <strong>{brief.counts.normal}</strong>
        </article>
        <article className="admin-metric">
          <span>Лиды ждут</span>
          <strong>{brief.counts.newLeadsWaiting}</strong>
        </article>
        <article className="admin-metric">
          <span>Оплаты на проверке</span>
          <strong>{brief.counts.paymentsUnderReview}</strong>
        </article>
        <article className="admin-metric">
          <span>Пробные · 24 часа</span>
          <strong>{brief.counts.trialsNext24h}</strong>
        </article>
        <article className="admin-metric">
          <span>Просрочена оценка</span>
          <strong>{brief.counts.progressDue}</strong>
        </article>
        <article className="admin-metric">
          <span>Активные ученики</span>
          <strong>{brief.counts.activeStudents}</strong>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Что делать сейчас</h2>
            <p className="admin-help">
              Сначала критические задачи, затем высокий приоритет и плановые.
            </p>
          </div>
          <Link className="admin-status" href="/admin">
            Открыть Dashboard →
          </Link>
        </div>

        <div className="assistant-action-list">
          {brief.actions.map((action, index) => (
            <article className="assistant-action-card" key={action.id}>
              <div className="assistant-action-rank">{index + 1}</div>
              <div className="assistant-action-body">
                <div className="assistant-action-meta">
                  <span
                    className={
                      action.priority === "critical"
                        ? "admin-attention"
                        : "admin-status"
                    }
                  >
                    {priorityLabels[action.priority]}
                  </span>
                  <span>{categoryLabels[action.category]}</span>
                  <span>{formatAdminDate(action.createdAt)}</span>
                </div>
                <h3>{action.title}</h3>
                {action.subject ? <strong>{action.subject}</strong> : null}
                <p>{action.reason}</p>
              </div>
              <Link className="button" href={action.href}>
                Открыть
              </Link>
            </article>
          ))}

          {brief.actions.length === 0 ? (
            <div className="admin-empty-panel">
              Сейчас нет задач, которые требуют действия.
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Как работает ассистент</h2>
        </div>
        <div className="assistant-explainer">
          <p>
            Ассистент не придумывает выводы. Он собирает открытые системные
            сигналы и операционные условия: просрочки оплаты, пропуски,
            просроченные оценки тренера, новые лиды без движения, ближайшие
            пробные и заполненность групп.
          </p>
          <p>
            Поэтому любой пункт можно открыть и проверить в исходной карточке
            CRM. Подключение языковой модели в будущем изменит форму диалога, но
            не источник фактов и бизнес-правила.
          </p>
        </div>
      </section>
    </>
  );
}
