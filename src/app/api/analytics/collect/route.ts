import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "@/server/security/rate-limit";

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

function cleanString(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanId(value: unknown) {
  const text = cleanString(value, 80);
  return text && ID_RE.test(text) ? text : null;
}

function cleanPath(value: unknown) {
  const path = cleanString(value, 300);
  if (!path) return null;
  if (
    path === "/ru" ||
    path.startsWith("/ru/") ||
    path === "/uz" ||
    path.startsWith("/uz/")
  ) {
    return path;
  }
  return null;
}

function cleanInt(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function localeFromPath(path: string) {
  return path === "/uz" || path.startsWith("/uz/") ? "uz" : "ru";
}

export async function POST(request: NextRequest) {
  const limit = await consumeRateLimit(request, {
    namespace: "web-analytics",
    limit: 240,
    windowSeconds: 60
  });

  if (!limit.allowed) {
    return rateLimitedResponse(limit.retryAfterSeconds);
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const event = cleanString(body.event, 40);
  const pageViewId = cleanId(body.pageViewId);
  const visitorId = cleanId(body.visitorId);
  const sessionId = cleanId(body.sessionId);
  const path = cleanPath(body.path);

  if (!event || !pageViewId || !visitorId || !sessionId || !path) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ANALYTICS_EVENT" },
      { status: 400 }
    );
  }

  const prisma = getPrisma();
  const now = new Date();

  if (event === "page_view") {
    const viewportWidth = cleanInt(body.viewportWidth, 200, 10000);

    await prisma.webPageView.upsert({
      where: { id: pageViewId },
      update: {
        lastSeenAt: now
      },
      create: {
        id: pageViewId,
        visitorId,
        sessionId,
        path,
        locale: localeFromPath(path),
        referrerHost: cleanString(body.referrerHost, 160),
        utmSource: cleanString(body.utmSource, 120),
        utmMedium: cleanString(body.utmMedium, 120),
        utmCampaign: cleanString(body.utmCampaign, 160),
        utmContent: cleanString(body.utmContent, 160),
        deviceType: cleanString(body.deviceType, 20),
        viewportWidth,
        startedAt: now,
        lastSeenAt: now
      }
    });

    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (event === "engagement") {
    const durationMs = cleanInt(body.durationMs, 0, 6 * 60 * 60 * 1000);
    const maxScrollPercent = cleanInt(body.maxScrollPercent, 0, 100);

    await prisma.webPageView.updateMany({
      where: {
        id: pageViewId,
        visitorId,
        sessionId
      },
      data: {
        lastSeenAt: now,
        ...(durationMs !== null ? { durationMs } : {}),
        ...(maxScrollPercent !== null ? { maxScrollPercent } : {})
      }
    });

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (event === "click") {
    const exists = await prisma.webPageView.findFirst({
      where: {
        id: pageViewId,
        visitorId,
        sessionId
      },
      select: { id: true }
    });

    if (!exists) {
      return NextResponse.json(
        { ok: true, skipped: true },
        { status: 202, headers: { "Cache-Control": "no-store" } }
      );
    }

    await prisma.webClick.create({
      data: {
        pageViewId,
        visitorId,
        sessionId,
        path,
        label: cleanString(body.label, 120),
        targetPath: cleanString(body.targetPath, 300),
        elementTag: cleanString(body.elementTag, 20),
        eventName: cleanString(body.eventName, 80) ?? "click",
        occurredAt: now
      }
    });

    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ok: false, error: "UNKNOWN_ANALYTICS_EVENT" },
    { status: 400 }
  );
}
