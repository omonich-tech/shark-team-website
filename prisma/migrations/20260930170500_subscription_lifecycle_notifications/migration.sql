-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PAST_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PAUSED';

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "enrollmentId" TEXT,
ADD COLUMN "subscriptionPaymentId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_enrollmentId_idx"
ON "Notification"("enrollmentId");

CREATE INDEX "Notification_subscriptionPaymentId_idx"
ON "Notification"("subscriptionPaymentId");

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_subscriptionPaymentId_fkey"
FOREIGN KEY ("subscriptionPaymentId") REFERENCES "SubscriptionPayment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
