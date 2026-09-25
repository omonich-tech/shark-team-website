-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'TRIAL_HELD';

-- CreateEnum
CREATE TYPE "TrialBookingStatus" AS ENUM (
  'HOLD',
  'CONFIRMED',
  'EXPIRED',
  'CANCELLED',
  'ATTENDED',
  'NO_SHOW'
);

-- CreateTable
CREATE TABLE "TrialBooking" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "TrialBookingStatus" NOT NULL DEFAULT 'HOLD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reminderAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialBooking_leadId_sessionId_key"
ON "TrialBooking"("leadId", "sessionId");

-- CreateIndex
CREATE INDEX "TrialBooking_sessionId_status_expiresAt_idx"
ON "TrialBooking"("sessionId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TrialBooking_status_expiresAt_idx"
ON "TrialBooking"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "TrialBooking"
ADD CONSTRAINT "TrialBooking_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBooking"
ADD CONSTRAINT "TrialBooking_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
