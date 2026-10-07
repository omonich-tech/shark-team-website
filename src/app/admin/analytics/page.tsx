import Link from "next/link";
import { getPrisma } from "@/lib/prisma";
import { dateKeyInTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Asia/Tashkent";
const DAY = 24 * 60 * 60 * 1000;
const RANGE_OPTIONS = [7, 30, 90] as const;

type RangeDays = (typeof RANGE_OPTIONS)[number];
type SearchParams = Promise<{ range?: string | string[] }>;

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function resolveRange(value: string | undefined): RangeDays {
  const parsed = Number(value);
  return RANGE_OPTIONS.includes(parsed as RangeDays)
    ? (parsed as RangeDays)
    : 30;
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatDuration(ms: number) {
  if (!ms) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds + " сек";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes + " мин " + rest + " сек";
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function topEntries(map: Map<string, number>, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export default async function AdminAnalyticsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const prisma = getPrisma();
  const params = await searchParams;
  const rangeDays = resolveRange(singleParam(params.range));
  const now = new Date();
  const rangeStart = new Date(now.getTime() - rangeDays * DAY);
  const dayStart = new Date(now.getTime() - DAY);
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const monthStart = new Date(now.getTime() - 30 * DAY);

  const [views, clicks, funnelEvents, dauRows, wauRows, mauRows] = await Promise.all([
    prisma.webPageView.findMany({
      where: { startedAt: { gte: rangeStart } },
      select: {
        visitorId: true,
        sessionId: true,
        path: true,
        locale: true,
        referrerHost: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        deviceType: true,
        startedAt: true,
        durationMs: true,
        maxScrollPercent: true
      },
      orderBy: { startedAt: "asc" }
    }),
    prisma.webClick.findMany({
      where: { occurredAt: { gte: rangeStart } },
      select: {
        path: true,
        label: true,
        targetPath: true,
        eventName: true,
        occurredAt: true
      },
      orderBy: { occurredAt: "desc" }
    }),
    prisma.webFunnelEvent.findMany({
      where: { occurredAt: { gte: rangeStart } },
      select: {
        visitorId: true,
        eventName: true,
        sportSlug: true,
        branchSlug: true,
        occurredAt: true
      },
      orderBy: { occurredAt: "asc" }
    }),
    prisma.webPageView.findMany({
      where: { startedAt: { gte: dayStart } },
      distinct: ["visitorId"],
      select: { visitorId: true }
    }),
    prisma.webPageView.findMany({
      where: { startedAt: { gte: weekStart } },
      distinct: ["visitorId"],
      select: { visitorId: true }
    }),
    prisma.webPageView.findMany({
      where: { startedAt: { gte: monthStart } },
      distinct: ["visitorId"],
      select: { visitorId: true }
    })
  ]);

  const visitors = new Set(views.map((view) => view.visitorId));
  const sessions = new Map<string, number>();
  const pages = new Map<string, number>();
  const pageDuration = new Map<string, { total: number; count: number }>();
  const sources = new Map<string, number>();
  const devices = new Map<string, number>();
  const locales = new Map<string, number>();
  const campaigns = new Map<string, number>();

  for (const view of views) {
    sessions.set(view.sessionId, (sessions.get(view.sessionId) ?? 0) + 1);
    pages.set(view.path, (pages.get(view.path) ?? 0) + 1);

    if (view.durationMs > 0) {
      const current = pageDuration.get(view.path) ?? { total: 0, count: 0 };
      current.total += view.durationMs;
      current.count += 1;
      pageDuration.set(view.path, current);
    }

    const source = view.utmSource || view.referrerHost || "Direct";
    sources.set(source, (sources.get(source) ?? 0) + 1);

    const device = view.deviceType || "unknown";
    devices.set(device, (devices.get(device) ?? 0) + 1);

    const locale = (view.locale || "unknown").toUpperCase();
    locales.set(locale, (locales.get(locale) ?? 0) + 1);

    if (view.utmCampaign) {
      campaigns.set(
        view.utmCampaign,
        (campaigns.get(view.utmCampaign) ?? 0) + 1
      );
    }
  }

  const engagedViews = views.filter((view) => view.durationMs > 0);
  const avgDuration = engagedViews.length
    ? Math.round(
        engagedViews.reduce((sum, view) => sum + view.durationMs, 0) /
          engagedViews.length
      )
    : 0;
  const avgScroll = views.length
    ? Math.round(
        views.reduce((sum, view) => sum + view.maxScrollPercent, 0) /
          views.length
      )
    : 0;
  const bouncedSessions = [...sessions.values()].filter((count) => count === 1)
    .length;
  const bounceRate = percent(bouncedSessions, sessions.size);

  const clickMap = new Map<string, number>();
  for (const click of clicks) {
    const key =
      click.label ||
      click.targetPath ||
      (click.eventName !== "click" ? click.eventName : null) ||
      "Без подписи";
    clickMap.set(key, (clickMap.get(key) ?? 0) + 1);
  }

  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(rangeStart.getTime() + index * DAY);
    return {
      key: dateKeyInTimeZone(date, TIME_ZONE),
      date,
      views: 0,
      visitors: new Set<string>()
    };
  });
  const dayMap = new Map(days.map((day) => [day.key, day]));

  for (const view of views) {
    const day = dayMap.get(dateKeyInTimeZone(view.startedAt, TIME_ZONE));
    if (!day) continue;
    day.views += 1;
    day.visitors.add(view.visitorId);
  }

  const chartDays =
    rangeDays <= 30
      ? days
      : days.filter((_, index) => index % 3 === 0 || index === days.length - 1);
  const chartMax = Math.max(
    1,
    ...chartDays.flatMap((day) => [day.views, day.visitors.size])
  );

  const topPages = topEntries(pages);
  const maxPageViews = Math.max(1, ...topPages.map(([, count]) => count));
  const topSources = topEntries(sources, 6);
  const maxSourceViews = Math.max(1, ...topSources.map(([, count]) => count));
  const topClicks = topEntries(clickMap, 8);
  const maxClicks = Math.max(1, ...topClicks.map(([, count]) => count));

  const funnelSteps = [
    ["sport_view", "Просмотр секции"],
    ["branch_view", "Просмотр филиала"],
    ["trial_cta_click", "Нажал «Записаться»"],
    ["trial_view", "Открыл пробное"],
    ["trial_form_started", "Начал форму"],
    ["lead_created", "Лид создан"],
    ["trial_booking_created", "Бронь создана"],
    ["payment_started", "Перешёл к оплате"],
    ["payment_success", "Оплата подтверждена"]
  ] as const;

  const funnelVisitors = new Map<string, Set<string>>();
  const sportInterest = new Map<string, Set<string>>();
  const branchInterest = new Map<string, Set<string>>();

  for (const event of funnelEvents) {
    const set = funnelVisitors.get(event.eventName) ?? new Set<string>();
    set.add(event.visitorId);
    funnelVisitors.set(event.eventName, set);

    if (event.sportSlug) {
      const sportSet = sportInterest.get(event.sportSlug) ?? new Set<string>();
      sportSet.add(event.visitorId);
      sportInterest.set(event.sportSlug, sportSet);
    }

    if (event.branchSlug) {
      const branchSet =
        branchInterest.get(event.branchSlug) ?? new Set<string>();
      branchSet.add(event.visitorId);
      branchInterest.set(event.branchSlug, branchSet);
    }
  }

  const funnelData = funnelSteps.map(([eventName, label]) => ({
    eventName,
    label,
    visitors: funnelVisitors.get(eventName)?.size ?? 0
  }));
  const funnelMax = Math.max(1, ...funnelData.map((step) => step.visitors));
  const trialVisitors = funnelVisitors.get("trial_view")?.size ?? 0;
  const paidVisitors = funnelVisitors.get("payment_success")?.size ?? 0;
  const trialToPaid = percent(paidVisitors, trialVisitors);

  const topSports = [...sportInterest.entries()]
    .map(([slug, set]) => [slug, set.size] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topBranches = [...branchInterest.entries()]
    .map(([slug, set]) => [slug, set.size] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="analytics-page">
      <header className="shark-dashboard-head">
        <div>
          <p className="eyebrow">WEB ANALYTICS</p>
          <h1>Аналитика сайта</h1>
          <p className="admin-help">
            Анонимные просмотры, посетители, поведение и источники трафика.
          </p>
        </div>

        <div className="dashboard-range">
          {RANGE_OPTIONS.map((option) => (
            <Link
              className={rangeDays === option ? "active" : undefined}
              href={"/admin/analytics?range=" + option}
              key={option}
            >
              {option} дней
            </Link>
          ))}
        </div>
      </header>

      <section className="dashboard-kpi-grid analytics-kpi-grid">
        <article className="dashboard-kpi-card featured">
          <div className="dashboard-kpi-top">
            <span>MAU</span>
            <em>30 дней</em>
          </div>
          <strong>{mauRows.length}</strong>
          <small>Уникальных посетителей за последние 30 дней</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>WAU</span>
            <em>7 дней</em>
          </div>
          <strong>{wauRows.length}</strong>
          <small>Активных посетителей за неделю</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>DAU</span>
            <em>24 часа</em>
          </div>
          <strong>{dauRows.length}</strong>
          <small>Активных посетителей за сутки</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Просмотры</span>
            <em>{rangeDays} дней</em>
          </div>
          <strong>{views.length}</strong>
          <small>{visitors.size} уникальных посетителей</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Среднее время</span>
            <em>страница</em>
          </div>
          <strong>{formatDuration(avgDuration)}</strong>
          <small>Средний scroll depth: {avgScroll}%</small>
        </article>

        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-top">
            <span>Bounce rate</span>
            <em>сессии</em>
          </div>
          <strong>{bounceRate}%</strong>
          <small>{sessions.size} сессий · {clicks.length} кликов</small>
        </article>
      </section>

      <section className="analytics-funnel-section">
        <article className="dashboard-card analytics-funnel-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Конверсия сайта</p>
              <h2>Путь до оплаты</h2>
            </div>
            <div className="analytics-funnel-conversion">
              <span>Пробное → оплата</span>
              <strong>{trialToPaid}%</strong>
            </div>
          </div>

          <div className="analytics-funnel-list">
            {funnelData.map((step, index) => {
              const previous =
                index > 0 ? funnelData[index - 1].visitors : null;
              const fromPrevious =
                previous && previous > 0
                  ? Math.round((step.visitors / previous) * 100)
                  : null;

              return (
                <div className="analytics-funnel-row" key={step.eventName}>
                  <div className="analytics-funnel-label">
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                  </div>
                  <div className="analytics-funnel-meter">
                    <i
                      style={{
                        width:
                          (step.visitors > 0
                            ? Math.max(6, (step.visitors / funnelMax) * 100)
                            : 0) + "%"
                      }}
                    />
                  </div>
                  <div className="analytics-funnel-value">
                    <strong>{step.visitors}</strong>
                    <small>
                      {fromPrevious === null
                        ? "уникальных"
                        : fromPrevious + "% от прошлого шага"}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="dashboard-card analytics-interest-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Интерес</p>
              <h2>Что смотрят</h2>
            </div>
          </div>

          <div className="analytics-interest-grid">
            <div>
              <span>Виды спорта</span>
              {topSports.map(([slug, count]) => (
                <p key={slug}>
                  <strong>{slug}</strong>
                  <em>{count}</em>
                </p>
              ))}
              {topSports.length === 0 ? <small>Пока нет данных</small> : null}
            </div>
            <div>
              <span>Филиалы</span>
              {topBranches.map(([slug, count]) => (
                <p key={slug}>
                  <strong>{slug}</strong>
                  <em>{count}</em>
                </p>
              ))}
              {topBranches.length === 0 ? <small>Пока нет данных</small> : null}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-card dashboard-trend-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Трафик</p>
              <h2>Просмотры и посетители</h2>
            </div>
            <div className="dashboard-legend">
              <span><i className="lead" />Просмотры</span>
              <span><i className="payment" />Посетители</span>
            </div>
          </div>

          <div className="dashboard-chart analytics-chart">
            {chartDays.map((day, index) => (
              <div className="dashboard-chart-day" key={day.key}>
                <div className="dashboard-chart-bars">
                  <i
                    className="lead"
                    style={{
                      height:
                        Math.max(4, (day.views / chartMax) * 100) + "%",
                      animationDelay: index * 18 + "ms"
                    }}
                    title={"Просмотры: " + day.views}
                  />
                  <i
                    className="payment"
                    style={{
                      height:
                        Math.max(4, (day.visitors.size / chartMax) * 100) + "%",
                      animationDelay: index * 18 + 40 + "ms"
                    }}
                    title={"Посетители: " + day.visitors.size}
                  />
                </div>
                <small>{dayLabel(day.date)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Источники</p>
              <h2>Откуда приходят</h2>
            </div>
          </div>
          <div className="analytics-bars">
            {topSources.map(([source, count]) => (
              <div className="analytics-bar-row" key={source}>
                <div>
                  <strong>{source}</strong>
                  <span>{count} просмотров</span>
                </div>
                <div className="dashboard-progress">
                  <i style={{ width: (count / maxSourceViews) * 100 + "%" }} />
                </div>
              </div>
            ))}
            {topSources.length === 0 ? (
              <div className="dashboard-empty">Данных пока нет.</div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="dashboard-entity-grid analytics-detail-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Страницы</p>
              <h2>Самые просматриваемые</h2>
            </div>
          </div>
          <div className="analytics-bars">
            {topPages.map(([path, count]) => {
              const duration = pageDuration.get(path);
              const avg = duration
                ? Math.round(duration.total / duration.count)
                : 0;
              return (
                <div className="analytics-bar-row" key={path}>
                  <div>
                    <strong>{path}</strong>
                    <span>{count} · {formatDuration(avg)}</span>
                  </div>
                  <div className="dashboard-progress">
                    <i style={{ width: (count / maxPageViews) * 100 + "%" }} />
                  </div>
                </div>
              );
            })}
            {topPages.length === 0 ? (
              <div className="dashboard-empty">Просмотров пока нет.</div>
            ) : null}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Клики</p>
              <h2>Что нажимают</h2>
            </div>
          </div>
          <div className="analytics-bars">
            {topClicks.map(([label, count]) => (
              <div className="analytics-bar-row" key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>{count} кликов</span>
                </div>
                <div className="dashboard-progress">
                  <i style={{ width: (count / maxClicks) * 100 + "%" }} />
                </div>
              </div>
            ))}
            {topClicks.length === 0 ? (
              <div className="dashboard-empty">Кликов пока нет.</div>
            ) : null}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <p className="admin-panel-kicker">Аудитория</p>
              <h2>Устройства и язык</h2>
            </div>
          </div>
          <div className="analytics-breakdown">
            <div>
              <span>Устройства</span>
              {topEntries(devices, 5).map(([name, count]) => (
                <p key={name}>
                  <strong>{name}</strong>
                  <em>{percent(count, views.length)}%</em>
                </p>
              ))}
            </div>
            <div>
              <span>Язык сайта</span>
              {topEntries(locales, 5).map(([name, count]) => (
                <p key={name}>
                  <strong>{name}</strong>
                  <em>{percent(count, views.length)}%</em>
                </p>
              ))}
            </div>
          </div>

          {campaigns.size > 0 ? (
            <div className="analytics-campaigns">
              <span>UTM campaigns</span>
              {topEntries(campaigns, 5).map(([name, count]) => (
                <p key={name}>
                  <strong>{name}</strong>
                  <em>{count}</em>
                </p>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="analytics-privacy-note">
        <strong>Privacy by design</strong>
        <span>
          IP, ФИО, телефоны и содержимое форм в Web Analytics не сохраняются.
          Admin и Coach кабинеты не отслеживаются.
        </span>
      </section>
    </div>
  );
}
