import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/jobs/auth";
import { runMaintenance } from "@/server/jobs/run-maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const result = await runMaintenance();

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("Maintenance job failed", error);

    return NextResponse.json(
      { ok: false, error: "MAINTENANCE_FAILED" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
