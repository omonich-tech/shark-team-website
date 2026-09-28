import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
    process.env.APP_VERSION ??
    "development";

  return NextResponse.json(
    {
      ok: true,
      service: "shark-team-platform",
      version
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
