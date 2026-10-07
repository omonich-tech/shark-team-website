"use client";

const VISITOR_KEY = "shark_analytics_visitor";
const SESSION_KEY = "shark_analytics_session";
const PAGEVIEW_KEY = "shark_analytics_pageview";

export type AnalyticsContext = {
  visitorId: string | null;
  sessionId: string | null;
  pageViewId: string | null;
};

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

export function trackFunnelEvent(
  eventName: string,
  detail: {
    label?: string | null;
    targetPath?: string | null;
    sportSlug?: string | null;
    branchSlug?: string | null;
  } = {}
) {
  if (typeof window === "undefined") return;

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
