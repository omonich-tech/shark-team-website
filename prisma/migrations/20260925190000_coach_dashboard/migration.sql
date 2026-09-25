-- CreateEnum
CREATE TYPE "StudentEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "CoachAccount" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "StudentEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "trialBookingId" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialAssessment" (
    "id" TEXT NOT NULL,
    "trialBookingId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "ability" INTEGER NOT NULL,
    "discipline" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "coordination" INTEGER NOT NULL,
    "physicalPreparation" INTEGER NOT NULL,
    "psychologicalReadiness" INTEGER NOT NULL,
    "coachComment" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachAccount_coachId_key" ON "CoachAccount"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachAccount_username_key" ON "CoachAccount"("username");

-- CreateIndex
CREATE INDEX "CoachAccount_isActive_idx" ON "CoachAccount"("isActive");

-- CreateIndex
CREATE INDEX "StudentEnrollment_childId_status_idx"
ON "StudentEnrollment"("childId", "status");

-- CreateIndex
CREATE INDEX "StudentEnrollment_groupId_status_idx"
ON "StudentEnrollment"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_trialBookingId_key"
ON "Attendance"("trialBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_childId_key"
ON "Attendance"("sessionId", "childId");

-- CreateIndex
CREATE INDEX "Attendance_coachId_markedAt_idx"
ON "Attendance"("coachId", "markedAt");

-- CreateIndex
CREATE INDEX "Attendance_childId_markedAt_idx"
ON "Attendance"("childId", "markedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrialAssessment_trialBookingId_key"
ON "TrialAssessment"("trialBookingId");

-- CreateIndex
CREATE INDEX "TrialAssessment_coachId_createdAt_idx"
ON "TrialAssessment"("coachId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoachAccount"
ADD CONSTRAINT "CoachAccount_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment"
ADD CONSTRAINT "StudentEnrollment_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance"
ADD CONSTRAINT "Attendance_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAssessment"
ADD CONSTRAINT "TrialAssessment_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialAssessment"
ADD CONSTRAINT "TrialAssessment_coachId_fkey"
FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
