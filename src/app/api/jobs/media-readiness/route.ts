import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { isCronAuthorized } from "@/server/jobs/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (process.env.MEDIA_DRY_RUN === "true") {
    return NextResponse.json(
      { ok: false, error: "MEDIA_DRY_RUN_ENABLED" },
      { status: 503 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { ok: false, error: "BLOB_READ_WRITE_TOKEN_MISSING" },
      { status: 503 }
    );
  }

  let uploadedUrl: string | null = null;

  try {
    const blob = await put(
      `shark/health/media-readiness-${Date.now()}.txt`,
      "shark-media-readiness",
      {
        access: "public",
        addRandomSuffix: true
      }
    );

    uploadedUrl = blob.url;
    await del(blob.url);

    return NextResponse.json({
      ok: true,
      storage: "vercel-blob",
      write: "ready",
      delete: "ready"
    });
  } catch (error) {
    console.error("Media storage readiness failed", {
      message: error instanceof Error ? error.message : "unknown",
      uploaded: Boolean(uploadedUrl)
    });

    if (uploadedUrl) {
      try {
        await del(uploadedUrl);
      } catch {
        // Best-effort cleanup only.
      }
    }

    return NextResponse.json(
      { ok: false, error: "MEDIA_STORAGE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
