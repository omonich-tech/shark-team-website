-- CreateEnum
CREATE TYPE "AbsenceReason" AS ENUM (
  'ILLNESS',
  'FAMILY',
  'TRAVEL',
  'SCHOOL',
  'OTHER'
);

CREATE TYPE "AttendanceReasonSource" AS ENUM (
  'COACH',
  'PARENT',
  'ADMIN'
);

-- AlterEnum
ALTER TYPE "NotificationType"
ADD VALUE IF NOT EXISTS 'REGULAR_ABSENCE_NOTICE';

-- AlterTable
ALTER TABLE "Attendance"
ADD COLUMN "absenceReason" "AbsenceReason",
ADD COLUMN "absenceNote" TEXT,
ADD COLUMN "reasonSource" "AttendanceReasonSource",
ADD COLUMN "reasonUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Notification"
ADD COLUMN "attendanceId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_attendanceId_idx"
ON "Notification"("attendanceId");

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_attendanceId_fkey"
FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
