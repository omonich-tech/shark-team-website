import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || !authorization) {
    return false;
  }

  return safeEqual(authorization, `Bearer ${secret}`);
}
