import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "shark-team-platform",
      database: "ready"
    });
  } catch (error) {
    console.error("Readiness check failed", error);

    return NextResponse.json(
      {
        ok: false,
        service: "shark-team-platform",
        database: "unavailable"
      },
      { status: 503 }
    );
  }
}
