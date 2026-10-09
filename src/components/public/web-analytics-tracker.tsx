"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  analyticsStorageKeys,
  pushMarketingFunnelEvent
} from "@/lib/web-analytics-client";

const VISITOR_KEY = analyticsStorageKeys.visitor;
const SESSION_KEY = analyticsStorageKeys.session;
const PAGEVIEW_KEY = analyticsStorageKeys.pageView;
const ACQUISITION_KEY = "shark_analytics_acquisition";

type Acquisition = {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
};

function randomId() {
  return crypto.randomUUID();
}

function getOrCreate(storage: Storage, key: string) {
  const current = storage.getItem(key);
  if (current) return current;
  const next = randomId();
  storage.setItem(key, next);
  return next;
}

function readAcquisition(): Acquisition {
  try {
    const current = sessionStorage.getItem(ACQUISITION_KEY);
    if (current) return JSON.parse(current) as Acquisition;

    const search = new URLSearchParams(window.location.search);
    let referrerHost: string | null = null;

    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.hostname !== window.location.hostname) {
          referrerHost = referrer.hostname.slice(0, 160);
        }
      } catch {}
    }

    const acquisition: Acquisition = {
      referrerHost,
      utmSource: search.get("utm_source")?.slice(0, 120) ?? null,
      utmMedium: search.get("utm_medium")?.slice(0, 120) ?? null,
      utmCampaign: search.get("utm_campaign")?.slice(0, 160) ?? null,
      utmContent: search.get("utm_content")?.slice(0, 160) ?? null
    };

    sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(acquisition));
    return acquisition;
  } catch {
    return {
      referrerHost: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null
    };
  }
}

function deviceType() {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1100) return "tablet";
  return "desktop";
}

function send(payload: Record<string, unknown>) {
  void fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: "omit"
  }).catch(() => undefined);
}

function safeTarget(element: Element) {
  if (element instanceof HTMLAnchorElement && element.href) {
    try {
      const url = new URL(element.href, window.location.origin);
      return url.origin === window.location.origin
        ? url.pathname
        : "external:" + url.hostname;
    } catch {
      return null;
    }
  }
  return null;
}

function safeLabel(element: Element) {
  const explicit = element.getAttribute("data-analytics-label");
  const aria = element.getAttribute("aria-label");
  const text =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? null
      : element.textContent;

  return (explicit ?? aria ?? text)?.replace(/\s+/g, " ").trim().slice(0, 120) || null;
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();
  const pageViewIdRef = useRef<string | null>(null);
  const visitorIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const maxScrollRef = useRef(0);

  useEffect(() => {
    if (navigator.doNotTrack === "1") return;
    if (
      !(
        pathname === "/ru" ||
        pathname.startsWith("/ru/") ||
        pathname === "/uz" ||
        pathname.startsWith("/uz/")
      )
    ) {
      return;
    }

    let visitorId: string;
    let sessionId: string;

    try {
      visitorId = getOrCreate(localStorage, VISITOR_KEY);
      sessionId = getOrCreate(sessionStorage, SESSION_KEY);
    } catch {
      visitorId = randomId();
      sessionId = randomId();
    }

    const pageViewId = randomId();
    const acquisition = readAcquisition();
    visitorIdRef.current = visitorId;
    sessionIdRef.current = sessionId;
    pageViewIdRef.current = pageViewId;
    try {
      sessionStorage.setItem(PAGEVIEW_KEY, pageViewId);
    } catch {}
    startedAtRef.current = Date.now();
    maxScrollRef.current = 0;

    send({
      event: "page_view",
      pageViewId,
      visitorId,
      sessionId,
      path: pathname,
      ...acquisition,
      deviceType: deviceType(),
      viewportWidth: window.innerWidth
    });

    const segments = pathname.split("/").filter(Boolean);
    const section = segments[1];
    const slug = segments[2] ?? null;

    if (section === "sports" && slug) {
      send({
        event: "funnel",
        eventName: "sport_view",
        pageViewId,
        visitorId,
        sessionId,
        path: pathname,
        sportSlug: slug
      });
    } else if (section === "branches" && slug) {
      send({
        event: "funnel",
        eventName: "branch_view",
        pageViewId,
        visitorId,
        sessionId,
        path: pathname,
        branchSlug: slug
      });
    } else if (section === "trial") {
      send({
        event: "funnel",
        eventName: "trial_view",
        pageViewId,
        visitorId,
        sessionId,
        path: pathname
      });
    }

    function updateScroll() {
      const doc = document.documentElement;
      const available = Math.max(1, doc.scrollHeight - window.innerHeight);
      const percent = Math.max(
        0,
        Math.min(100, Math.round((window.scrollY / available) * 100))
      );
      maxScrollRef.current = Math.max(maxScrollRef.current, percent);
    }

    function flushEngagement() {
      send({
        event: "engagement",
        pageViewId,
        visitorId,
        sessionId,
        path: pathname,
        durationMs: Date.now() - startedAtRef.current,
        maxScrollPercent: maxScrollRef.current
      });
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") flushEngagement();
    }

    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("pagehide", flushEngagement);
    document.addEventListener("visibilitychange", onVisibility);
    updateScroll();

    const timer = window.setInterval(flushEngagement, 15000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("pagehide", flushEngagement);
      document.removeEventListener("visibilitychange", onVisibility);
      flushEngagement();
    };
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (navigator.doNotTrack === "1") return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactive = target.closest(
        "a,button,[data-analytics-event]"
      );
      if (!interactive) return;

      if (
        interactive instanceof HTMLInputElement ||
        interactive instanceof HTMLTextAreaElement ||
        interactive instanceof HTMLSelectElement
      ) {
        return;
      }

      const pageViewId = pageViewIdRef.current;
      const visitorId = visitorIdRef.current;
      const sessionId = sessionIdRef.current;

      if (!pageViewId || !visitorId || !sessionId) return;

      const customEvent = interactive.getAttribute("data-analytics-event");
      const label = safeLabel(interactive);
      const targetPath = safeTarget(interactive);

      send({
        event: "click",
        pageViewId,
        visitorId,
        sessionId,
        path: window.location.pathname,
        label,
        targetPath,
        elementTag: interactive.tagName.toLowerCase(),
        eventName: customEvent ?? "click"
      });

      if (customEvent) {
        pushMarketingFunnelEvent(customEvent, {
          label,
          targetPath
        });

        send({
          event: "funnel",
          eventName: customEvent,
          pageViewId,
          visitorId,
          sessionId,
          path: window.location.pathname,
          label,
          targetPath
        });
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    function onFunnel(event: Event) {
      const custom = event as CustomEvent<{
        eventName?: string;
        label?: string | null;
        targetPath?: string | null;
        sportSlug?: string | null;
        branchSlug?: string | null;
      }>;

      const pageViewId = pageViewIdRef.current;
      const visitorId = visitorIdRef.current;
      const sessionId = sessionIdRef.current;
      const eventName = custom.detail?.eventName;

      if (!pageViewId || !visitorId || !sessionId || !eventName) return;

      send({
        event: "funnel",
        eventName,
        pageViewId,
        visitorId,
        sessionId,
        path: window.location.pathname,
        label: custom.detail?.label ?? null,
        targetPath: custom.detail?.targetPath ?? null,
        sportSlug: custom.detail?.sportSlug ?? null,
        branchSlug: custom.detail?.branchSlug ?? null
      });
    }

    window.addEventListener("shark:analytics-funnel", onFunnel);
    return () => window.removeEventListener("shark:analytics-funnel", onFunnel);
  }, []);

  return null;
}
