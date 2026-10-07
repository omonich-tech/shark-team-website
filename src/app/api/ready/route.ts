import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { EXPECTED_LATEST_MIGRATION } from "@/server/database/schema-version";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();

    const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT "migration_name"
      FROM "_prisma_migrations"
      WHERE "migration_name" = ${EXPECTED_LATEST_MIGRATION}
        AND "finished_at" IS NOT NULL
        AND "rolled_back_at" IS NULL
      LIMIT 1
    `;

    if (applied.length !== 1) {
      throw new Error("DATABASE_SCHEMA_OUTDATED");
    }

    await Promise.all([
      prisma.operationalAlert.findFirst({
        select: { id: true }
      }),
      prisma.subscriptionFreezeRequest.findFirst({
        select: { id: true }
      }),
      prisma.notification.findFirst({
        select: {
          trainingSessionId: true,
          contextJson: true
        }
      }),
      prisma.trainingSession.findFirst({
        select: { completedAt: true }
      }),
      prisma.webPageView.findFirst({
        select: { id: true }
      }),
      prisma.webFunnelEvent.findFirst({
        select: { id: true }
      })
    ]);

    return NextResponse.json(
      {
        ok: true,
        service: "shark-team-platform",
        database: "ready",
        schema: "ready"
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Readiness check failed", error);

    return NextResponse.json(
      {
        ok: false,
        service: "shark-team-platform",
        database: "unavailable",
        schema: "unavailable"
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
