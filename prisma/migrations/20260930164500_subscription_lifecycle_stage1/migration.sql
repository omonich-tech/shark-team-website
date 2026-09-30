-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'PAYMENT_DUE',
  'PAST_DUE',
  'PAUSED',
  'ENDED'
);

-- AlterTable
ALTER TABLE "StudentEnrollment"
ADD COLUMN "subscriptionStatus" "SubscriptionStatus",
ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN "nextPaymentDueAt" TIMESTAMP(3),
ADD COLUMN "graceUntil" TIMESTAMP(3),
ADD COLUMN "pausedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubscriptionPayment"
ADD COLUMN "enrollmentId" TEXT,
ADD COLUMN "sequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "periodStart" TIMESTAMP(3),
ADD COLUMN "periodEnd" TIMESTAMP(3),
ADD COLUMN "dueAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "SubscriptionPayment_trialConversionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_trialConversionId_sequence_key"
ON "SubscriptionPayment"("trialConversionId", "sequence");

CREATE INDEX "StudentEnrollment_subscriptionStatus_nextPaymentDueAt_idx"
ON "StudentEnrollment"("subscriptionStatus", "nextPaymentDueAt");

CREATE INDEX "SubscriptionPayment_enrollmentId_status_idx"
ON "SubscriptionPayment"("enrollmentId", "status");

CREATE INDEX "SubscriptionPayment_dueAt_status_idx"
ON "SubscriptionPayment"("dueAt", "status");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
