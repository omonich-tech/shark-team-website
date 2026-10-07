ALTER TABLE "Lead"
ADD COLUMN "analyticsVisitorId" TEXT,
ADD COLUMN "analyticsSessionId" TEXT,
ADD COLUMN "analyticsPageViewId" TEXT;

CREATE INDEX "Lead_analyticsVisitorId_createdAt_idx"
ON "Lead"("analyticsVisitorId", "createdAt");

CREATE TABLE "WebFunnelEvent" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "pageViewId" TEXT,
  "eventName" TEXT NOT NULL,
  "path" TEXT,
  "sportSlug" TEXT,
  "branchSlug" TEXT,
  "leadId" TEXT,
  "bookingId" TEXT,
  "paymentId" TEXT,
  "dedupeKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebFunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebFunnelEvent_dedupeKey_key"
ON "WebFunnelEvent"("dedupeKey");

CREATE INDEX "WebFunnelEvent_occurredAt_idx"
ON "WebFunnelEvent"("occurredAt");

CREATE INDEX "WebFunnelEvent_eventName_occurredAt_idx"
ON "WebFunnelEvent"("eventName", "occurredAt");

CREATE INDEX "WebFunnelEvent_visitorId_eventName_occurredAt_idx"
ON "WebFunnelEvent"("visitorId", "eventName", "occurredAt");

CREATE INDEX "WebFunnelEvent_sessionId_eventName_occurredAt_idx"
ON "WebFunnelEvent"("sessionId", "eventName", "occurredAt");

CREATE INDEX "WebFunnelEvent_leadId_eventName_idx"
ON "WebFunnelEvent"("leadId", "eventName");

CREATE INDEX "WebFunnelEvent_bookingId_eventName_idx"
ON "WebFunnelEvent"("bookingId", "eventName");

CREATE INDEX "WebFunnelEvent_paymentId_eventName_idx"
ON "WebFunnelEvent"("paymentId", "eventName");
