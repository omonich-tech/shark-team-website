ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REGULAR_SESSION_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REGULAR_SESSION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REGULAR_SESSION_RESCHEDULED';

ALTER TABLE "Notification"
ADD COLUMN "trainingSessionId" TEXT,
ADD COLUMN "contextJson" JSONB;

CREATE INDEX "Notification_trainingSessionId_idx"
ON "Notification"("trainingSessionId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_trainingSessionId_fkey"
FOREIGN KEY ("trainingSessionId")
REFERENCES "TrainingSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
