-- AlterEnum
ALTER TYPE "NotificationType"
ADD VALUE IF NOT EXISTS 'STUDENT_PROGRESS_UPDATE';

CREATE TABLE "StudentProgressAssessment" (
  "id" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "ability" INTEGER NOT NULL,
  "discipline" INTEGER NOT NULL,
  "motivation" INTEGER NOT NULL,
  "coordination" INTEGER NOT NULL,
  "physicalPreparation" INTEGER NOT NULL,
  "psychologicalReadiness" INTEGER NOT NULL,
  "coachComment" TEXT,
  "recommendation" TEXT,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentProgressAssessment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
ADD COLUMN "progressAssessmentId" TEXT;

CREATE INDEX "StudentProgressAssessment_childId_assessedAt_idx"
ON "StudentProgressAssessment"("childId", "assessedAt");

CREATE INDEX "StudentProgressAssessment_groupId_assessedAt_idx"
ON "StudentProgressAssessment"("groupId", "assessedAt");

CREATE INDEX "StudentProgressAssessment_coachId_assessedAt_idx"
ON "StudentProgressAssessment"("coachId", "assessedAt");

CREATE INDEX "Notification_progressAssessmentId_idx"
ON "Notification"("progressAssessmentId");

ALTER TABLE "StudentProgressAssessment"
ADD CONSTRAINT "StudentProgressAssessment_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProgressAssessment"
ADD CONSTRAINT "StudentProgressAssessment_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProgressAssessment"
ADD CONSTRAINT "StudentProgressAssessment_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_progressAssessmentId_fkey"
FOREIGN KEY ("progressAssessmentId") REFERENCES "StudentProgressAssessment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
