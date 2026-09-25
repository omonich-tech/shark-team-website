import { NextRequest, NextResponse } from "next/server";
import { createWebsiteLead } from "@/server/leads/create-website-lead";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
      utmContent: typeof body.utmContent === "string" ? body.utmContent : null
    });

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
