import { NextRequest, NextResponse } from "next/server";
import { submitIndexNowUrls } from "@/lib/indexnow";
import { isCronAuthorized } from "@/server/jobs/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const urls =
    body && typeof body === "object" && Array.isArray(body.urls)
      ? body.urls.filter((value: unknown): value is string => typeof value === "string")
      : null;

  if (!urls || urls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "URLS_REQUIRED" },
      { status: 400 }
    );
  }

  try {
    const result = await submitIndexNowUrls(urls);

    if (!result.submitted) {
      return NextResponse.json(
        { ok: false, error: result.reason },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("IndexNow submission failed", error);

    return NextResponse.json(
      { ok: false, error: "INDEXNOW_SUBMISSION_FAILED" },
      { status: 502 }
    );
  }
}
