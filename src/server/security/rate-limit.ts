import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

type RateLimitOptions = {
  namespace: string;
  limit: number;
  windowSeconds: number;
};

function clientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function fingerprint(value: string) {
  const salt =
    process.env.RATE_LIMIT_SALT ??
    (process.env.NODE_ENV === "production"
      ? "missing-production-rate-limit-salt"
      : "shark-team-local-rate-limit");

  return createHmac("sha256", salt).update(value).digest("hex");
}

export async function consumeRateLimit(
  request: NextRequest,
  options: RateLimitOptions
) {
  const prisma = getPrisma();
  const now = new Date();
  const nextReset = new Date(
    now.getTime() + options.windowSeconds * 1000
  );

  const key = `${options.namespace}:${fingerprint(clientAddress(request))}`;

  const rows = await prisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >`
    INSERT INTO "RateLimitBucket"
      ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES
      (${key}, 1, ${nextReset}, ${now}, ${now})
    ON CONFLICT ("key")
    DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now}
          THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now}
          THEN ${nextReset}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const bucket = rows[0];

  if (!bucket) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: options.windowSeconds
    };
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000)
  );

  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds
  };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      ok: false,
      error: "RATE_LIMITED",
      retryAfterSeconds
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store"
      }
    }
  );
}
