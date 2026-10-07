import { NextRequest, NextResponse } from "next/server";
import { createWebsiteLead } from "@/server/leads/create-website-lead";
import { recordLeadFunnelEvent } from "@/server/analytics/funnel";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit(request, {
    namespace: "public-leads",
    limit: 30,
    windowSeconds: 60 * 60
  });

  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  try {
    const body = await request.json();

    const result = await createWebsiteLead({
      parentName: String(body.parentName ?? ""),
      childName: String(body.childName ?? ""),
      phone: String(body.phone ?? ""),
      childAge: Number(body.childAge),
      locale: body.locale === "uz" ? "uz" : "ru",
      selectedSessionId: String(body.selectedSessionId ?? ""),
      landingPage:
        typeof body.landingPage === "string" ? body.landingPage : null,
      utmSource: typeof body.utmSource === "string" ? body.utmSource : null,
      utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : null,
      utmCampaign:
        typeof body.utmCampaign === "string" ? body.utmCampaign : null,
      utmContent: typeof body.utmContent === "string" ? body.utmContent : null,
      analyticsVisitorId:
        typeof body.analyticsVisitorId === "string" ? body.analyticsVisitorId : null,
      analyticsSessionId:
        typeof body.analyticsSessionId === "string" ? body.analyticsSessionId : null,
      analyticsPageViewId:
        typeof body.analyticsPageViewId === "string" ? body.analyticsPageViewId : null
    });

    if (result.ok) {
      await recordLeadFunnelEvent({
        leadId: result.lead.id,
        eventName: "lead_created",
        dedupeKey: "lead:" + result.lead.id + ":created"
      });
    }

    return NextResponse.json(result, {
      status: result.ok ? 201 : 400
    });
  } catch (error) {
    console.error("Lead capture API failed", error);

    return NextResponse.json(
      { ok: false, error: "LEAD_CAPTURE_FAILED" },
      { status: 500 }
    );
  }
}
