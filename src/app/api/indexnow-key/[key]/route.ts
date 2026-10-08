import { NextRequest } from "next/server";
import { getIndexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  let configuredKey: string | null;

  try {
    configuredKey = getIndexNowKey();
  } catch (error) {
    console.error("IndexNow key configuration is invalid", error);
    return new Response("IndexNow is not configured", { status: 500 });
  }

  const { key } = await params;

  if (!configuredKey || key !== configuredKey) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  return new Response(configuredKey, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
