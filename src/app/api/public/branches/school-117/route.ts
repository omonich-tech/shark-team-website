import { NextResponse } from "next/server";
import { getBranchPublicData } from "@/server/public-data/branch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const branch = await getBranchPublicData("school-117");

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
