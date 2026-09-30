CREATE TYPE "OperationalAlertType" AS ENUM ('ATTENDANCE_RISK', 'PROGRESS_OVERDUE', 'PAYMENT_ATTENTION');
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "type" "OperationalAlertType" NOT NULL,
    "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "childId" TEXT,
    "enrollmentId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalAlert_dedupeKey_key" ON "OperationalAlert"("dedupeKey");
CREATE INDEX "OperationalAlert_status_type_openedAt_idx" ON "OperationalAlert"("status", "type", "openedAt");
CREATE INDEX "OperationalAlert_childId_status_idx" ON "OperationalAlert"("childId", "status");
CREATE INDEX "OperationalAlert_groupId_status_idx" ON "OperationalAlert"("groupId", "status");
CREATE INDEX "OperationalAlert_enrollmentId_status_idx" ON "OperationalAlert"("enrollmentId", "status");

ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
