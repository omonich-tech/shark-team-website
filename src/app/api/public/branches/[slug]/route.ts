import { NextResponse } from "next/server";
import { getBranchPublicData } from "@/server/public-data/branch";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  try {
    const branch = await getBranchPublicData(slug);

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
    console.error("Public branch API failed", { slug, error });

    return NextResponse.json(
      { ok: false, error: "DATABASE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
