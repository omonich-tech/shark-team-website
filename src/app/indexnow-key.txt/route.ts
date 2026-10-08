import { getIndexNowKey } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export function GET() {
  let key: string | null;

  try {
    key = getIndexNowKey();
  } catch (error) {
    console.error("IndexNow key configuration is invalid", error);
    return new Response("IndexNow is not configured", { status: 500 });
  }

  if (!key) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
