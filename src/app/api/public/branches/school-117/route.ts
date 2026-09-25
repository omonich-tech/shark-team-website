import { NextResponse } from "next/server";
import { getSchool117PublicData } from "@/server/public-data/school-117";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branch = await getSchool117PublicData();

    if (!branch) {
      return NextResponse.json(
        { ok: false, error: "BRANCH_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      branch
    });
  } catch (error) {
    console.error("School 117 API failed", error);

    return NextResponse.json(
      { ok: false, error: "DATABASE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
