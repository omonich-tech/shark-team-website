"use client";

const VISITOR_KEY = "shark_analytics_visitor";
const SESSION_KEY = "shark_analytics_session";
const PAGEVIEW_KEY = "shark_analytics_pageview";

export type AnalyticsContext = {
  visitorId: string | null;
  sessionId: string | null;
  pageViewId: string | null;
};

export type FunnelEventDetail = {
  label?: string | null;
  targetPath?: string | null;
  sportSlug?: string | null;
  branchSlug?: string | null;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

function read(key: string, storage: Storage) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function getAnalyticsContext(): AnalyticsContext {
  if (typeof window === "undefined") {
    return { visitorId: null, sessionId: null, pageViewId: null };
  }

  return {
    visitorId: read(VISITOR_KEY, localStorage),
    sessionId: read(SESSION_KEY, sessionStorage),
    pageViewId: read(PAGEVIEW_KEY, sessionStorage)
  };
}

export function pushMarketingFunnelEvent(
  eventName: string,
  detail: FunnelEventDetail = {}
) {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: "shark_funnel",
    funnel_step: eventName,
    sport_slug: detail.sportSlug ?? undefined,
    branch_slug: detail.branchSlug ?? undefined,
    label: detail.label ?? undefined,
    target_path: detail.targetPath ?? undefined,
    shark_surface: "public"
  });
}

export function trackFunnelEvent(
  eventName: string,
  detail: FunnelEventDetail = {}
) {
  if (typeof window === "undefined") return;

  pushMarketingFunnelEvent(eventName, detail);

  window.dispatchEvent(
    new CustomEvent("shark:analytics-funnel", {
      detail: { eventName, ...detail }
    })
  );
}

export const analyticsStorageKeys = {
  visitor: VISITOR_KEY,
  session: SESSION_KEY,
  pageView: PAGEVIEW_KEY
} as const;
