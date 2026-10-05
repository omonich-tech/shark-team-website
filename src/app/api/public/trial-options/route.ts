import { NextRequest, NextResponse } from "next/server";
import { getTrialOptions } from "@/server/trial/get-trial-options";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const age = Number(request.nextUrl.searchParams.get("age"));
  const sport =
    request.nextUrl.searchParams.get("sport")?.trim() || "basketball";
  const branch =
    request.nextUrl.searchParams.get("branch")?.trim() || "school-117";

  try {
    const result = await getTrialOptions(age, sport, branch);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400
    });
  } catch (error) {
    console.error("Trial options API failed", error);

    return NextResponse.json(
      { ok: false, error: "DATABASE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
