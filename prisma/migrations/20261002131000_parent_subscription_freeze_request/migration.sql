CREATE TYPE "SubscriptionFreezeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "SubscriptionFreezeRequest" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "SubscriptionFreezeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "decisionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionFreezeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionFreezeRequest_enrollmentId_status_createdAt_idx"
ON "SubscriptionFreezeRequest"("enrollmentId", "status", "createdAt");

CREATE INDEX "SubscriptionFreezeRequest_parentId_status_createdAt_idx"
ON "SubscriptionFreezeRequest"("parentId", "status", "createdAt");

CREATE INDEX "SubscriptionFreezeRequest_status_createdAt_idx"
ON "SubscriptionFreezeRequest"("status", "createdAt");

ALTER TABLE "SubscriptionFreezeRequest"
ADD CONSTRAINT "SubscriptionFreezeRequest_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionFreezeRequest"
ADD CONSTRAINT "SubscriptionFreezeRequest_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
