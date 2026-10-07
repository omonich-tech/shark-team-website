"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import posthog from "posthog-js";

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
const HOST = "/ingest";
const UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_APP_URL?.trim() || "https://eu.posthog.com";

function isPublicPath(pathname: string) {
  return (
    pathname === "/ru" ||
    pathname.startsWith("/ru/") ||
    pathname === "/uz" ||
    pathname.startsWith("/uz/")
  );
}

function safeUrlPath(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function PostHogPublicRecorder() {
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const lastPageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TOKEN || initializedRef.current || !isPublicPath(pathname)) {
      return;
    }

    posthog.init(TOKEN, {
      api_host: HOST,
      ui_host: UI_HOST,
      defaults: "2026-05-30",
      person_profiles: "identified_only",
      persistence: "localStorage",
      respect_dnt: true,
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: true,
      capture_heatmaps: true,
      disable_scroll_properties: false,
      capture_dead_clicks: true,
      capture_exceptions: false,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ph-mask,[data-ph-mask]",
        blockSelector: ".ph-no-capture,[data-ph-no-capture]"
      },
      before_send: (event) => {
        if (!event) return null;

        const currentPath =
          safeUrlPath(
            typeof event.properties?.$current_url === "string"
              ? event.properties.$current_url
              : undefined
          ) ?? window.location.pathname;

        return isPublicPath(currentPath) ? event : null;
      }
    });

    initializedRef.current = true;
    posthog.startSessionRecording();
  }, [pathname]);

  useEffect(() => {
    if (!TOKEN || !initializedRef.current || !isPublicPath(pathname)) return;
    if (lastPageRef.current === pathname) return;

    lastPageRef.current = pathname;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      shark_surface: "public"
    });
  }, [pathname]);

  useEffect(() => {
    if (!TOKEN) return;

    function onFunnel(event: Event) {
      if (!initializedRef.current) return;

      const custom = event as CustomEvent<{
        eventName?: string;
        sportSlug?: string | null;
        branchSlug?: string | null;
      }>;

      const eventName = custom.detail?.eventName?.trim();
      if (!eventName) return;

      posthog.capture("shark_funnel", {
        funnel_step: eventName,
        sport_slug: custom.detail?.sportSlug ?? undefined,
        branch_slug: custom.detail?.branchSlug ?? undefined,
        shark_surface: "public"
      });
    }

    window.addEventListener("shark:analytics-funnel", onFunnel);
    return () => {
      window.removeEventListener("shark:analytics-funnel", onFunnel);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (initializedRef.current) {
        posthog.stopSessionRecording();
      }
    };
  }, []);

  return null;
}
