CREATE TABLE "WebPageView" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "locale" TEXT,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "deviceType" TEXT,
    "viewportWidth" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "maxScrollPercent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebPageView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebClick" (
    "id" TEXT NOT NULL,
    "pageViewId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT,
    "targetPath" TEXT,
    "elementTag" TEXT,
    "eventName" TEXT NOT NULL DEFAULT 'click',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebPageView_startedAt_idx" ON "WebPageView"("startedAt");
CREATE INDEX "WebPageView_visitorId_startedAt_idx" ON "WebPageView"("visitorId", "startedAt");
CREATE INDEX "WebPageView_sessionId_startedAt_idx" ON "WebPageView"("sessionId", "startedAt");
CREATE INDEX "WebPageView_path_startedAt_idx" ON "WebPageView"("path", "startedAt");
CREATE INDEX "WebPageView_utmSource_startedAt_idx" ON "WebPageView"("utmSource", "startedAt");
CREATE INDEX "WebPageView_referrerHost_startedAt_idx" ON "WebPageView"("referrerHost", "startedAt");

CREATE INDEX "WebClick_occurredAt_idx" ON "WebClick"("occurredAt");
CREATE INDEX "WebClick_pageViewId_occurredAt_idx" ON "WebClick"("pageViewId", "occurredAt");
CREATE INDEX "WebClick_visitorId_occurredAt_idx" ON "WebClick"("visitorId", "occurredAt");
CREATE INDEX "WebClick_path_occurredAt_idx" ON "WebClick"("path", "occurredAt");
CREATE INDEX "WebClick_eventName_occurredAt_idx" ON "WebClick"("eventName", "occurredAt");

ALTER TABLE "WebClick"
ADD CONSTRAINT "WebClick_pageViewId_fkey"
FOREIGN KEY ("pageViewId") REFERENCES "WebPageView"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
