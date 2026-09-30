-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'FROZEN';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_FROZEN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RESUMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_ENDED';

-- AlterTable
ALTER TABLE "StudentEnrollment"
ADD COLUMN "freezeStartedAt" TIMESTAMP(3),
ADD COLUMN "freezeUntil" TIMESTAMP(3),
ADD COLUMN "freezeReason" TEXT,
ADD COLUMN "endReason" TEXT;

-- CreateIndex
CREATE INDEX "StudentEnrollment_subscriptionStatus_freezeUntil_idx"
ON "StudentEnrollment"("subscriptionStatus", "freezeUntil");
