import { NextRequest, NextResponse } from "next/server";
import { getTrialOptions } from "@/server/trial/get-trial-options";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const age = Number(request.nextUrl.searchParams.get("age"));

  try {
    const result = await getTrialOptions(age);

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
