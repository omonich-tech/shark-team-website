import "dotenv/config";
import { NextRequest } from "next/server";
import {
  LeadStatus,
  TrialBookingStatus
} from "../src/generated/prisma/client";
import { getPrisma } from "../src/lib/prisma";
import {
  consumeRateLimit,
  rateLimitedResponse
} from "../src/server/security/rate-limit";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const cronSecret = process.env.CRON_SECRET;
const prisma = getPrisma();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(cronSecret, "CRON_SECRET is required for production smoke");

  const health = await fetch(`${baseUrl}/api/health`);
  assert(health.ok, "Health endpoint failed");

  const ready = await fetch(`${baseUrl}/api/ready`);
  const readyPayload = await ready.json();
  assert(
    ready.ok && readyPayload.database === "ready",
    "Database readiness endpoint failed"
  );

  const publicPage = await fetch(`${baseUrl}/ru`);
  assert(publicPage.ok, "Public homepage failed");
  assert(
    publicPage.headers.get("x-content-type-options") === "nosniff",
    "X-Content-Type-Options is missing"
  );
  assert(
    publicPage.headers.get("x-frame-options") === "DENY",
    "X-Frame-Options is missing"
  );
  assert(
    publicPage.headers
      .get("content-security-policy")
      ?.includes("frame-ancestors 'none'"),
    "Content-Security-Policy is missing frame protection"
  );
  assert(
    publicPage.headers.get("referrer-policy") ===
      "strict-origin-when-cross-origin",
    "Referrer-Policy is missing"
  );

  const robots = await fetch(`${baseUrl}/robots.txt`);
  const robotsText = await robots.text();
  assert(robots.ok, "robots.txt failed");
  assert(
    robotsText.includes("Disallow: /admin") &&
      robotsText.includes("Disallow: /api"),
    "robots.txt does not protect private routes"
  );

  const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemapText = await sitemap.text();
  assert(sitemap.ok, "sitemap.xml failed");
  assert(
    sitemapText.includes("/ru/branches/school-117") &&
      sitemapText.includes("/uz/branches/school-117"),
    "sitemap is missing School 117"
  );

  const unauthorizedMaintenance = await fetch(
    `${baseUrl}/api/jobs/maintenance`,
    { method: "POST" }
  );
  assert(
    unauthorizedMaintenance.status === 401,
    "Maintenance job must reject missing authorization"
  );

  const sessionToRestore = await prisma.trainingSession.findFirst({
    where: {
      startsAt: { gt: new Date() },
      trialBookings: { none: {} }
    },
    orderBy: { startsAt: "asc" }
  });

  assert(sessionToRestore, "No safe Session found for maintenance test");

  const sessionSnapshot = {
    groupId: sessionToRestore.groupId,
    startsAt: sessionToRestore.startsAt
  };

  await prisma.trainingSession.delete({
    where: { id: sessionToRestore.id }
  });

  const replacementSession = await prisma.trainingSession.findFirst({
    where: {
      groupId: sessionToRestore.groupId,
      startsAt: { gt: new Date() }
    },
    orderBy: { startsAt: "asc" }
  });

  assert(
    replacementSession,
    "No Session available for expired HOLD test"
  );

  const lead = await prisma.lead.create({
    data: {
      status: LeadStatus.TRIAL_HELD,
      parentName: "Production Smoke Parent",
      childName: "Production Smoke Child",
      phone: "+998900009999",
      childAge: 10,
      locale: "ru",
      source: "ci-production-smoke",
      groupId: replacementSession.groupId,
      selectedSessionId: replacementSession.id
    }
  });

  const expiredBooking = await prisma.trialBooking.create({
    data: {
      leadId: lead.id,
      sessionId: replacementSession.id,
      status: TrialBookingStatus.HOLD,
      expiresAt: new Date(Date.now() - 60_000)
    }
  });

  const maintenance = await fetch(
    `${baseUrl}/api/jobs/maintenance`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`
      }
    }
  );
  const maintenancePayload = await maintenance.json();

  assert(
    maintenance.ok && maintenancePayload.ok,
    "Authorized maintenance job failed"
  );

  const [restoredSession, expired] = await Promise.all([
    prisma.trainingSession.findFirst({
      where: {
        groupId: sessionSnapshot.groupId,
        startsAt: sessionSnapshot.startsAt
      }
    }),
    prisma.trialBooking.findUnique({
      where: { id: expiredBooking.id }
    })
  ]);

  assert(
    restoredSession,
    "Maintenance did not regenerate the deleted Session"
  );
  assert(
    expired?.status === TrialBookingStatus.EXPIRED,
    "Maintenance did not expire stale HOLD"
  );

  const rateRequest = new NextRequest(
    "http://localhost/security-rate-limit-test",
    {
      headers: {
        "x-forwarded-for": "203.0.113.99"
      }
    }
  );
  const namespace = `production-smoke-${Date.now()}`;

  const first = await consumeRateLimit(rateRequest, {
    namespace,
    limit: 2,
    windowSeconds: 60
  });
  const second = await consumeRateLimit(rateRequest, {
    namespace,
    limit: 2,
    windowSeconds: 60
  });
  const third = await consumeRateLimit(rateRequest, {
    namespace,
    limit: 2,
    windowSeconds: 60
  });

  assert(first.allowed && second.allowed, "Rate limit allowed too little");
  assert(!third.allowed, "Rate limit did not block excess request");
  assert(
    rateLimitedResponse(third.retryAfterSeconds).status === 429,
    "Rate limit response is not HTTP 429"
  );

  console.log("Production hardening smoke test passed.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
