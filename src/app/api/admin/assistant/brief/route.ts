import { NextResponse } from "next/server";
import { getAdminSession } from "@/server/admin/auth";
import { buildOperationsAssistantBrief } from "@/server/assistant/operations-brief";

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const brief = await buildOperationsAssistantBrief();

  return NextResponse.json({
    ok: true,
    brief: {
      ...brief,
      generatedAt: brief.generatedAt.toISOString(),
      actions: brief.actions.map((action) => ({
        ...action,
        createdAt: action.createdAt.toISOString()
      }))
    }
  });
}
