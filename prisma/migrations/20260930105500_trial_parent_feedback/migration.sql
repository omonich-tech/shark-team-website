-- CreateTable
CREATE TABLE "TrialFeedback" (
    "id" TEXT NOT NULL,
    "trialBookingId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "completedAt" TIMESTAMP(3),
    "adminNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialFeedback_trialBookingId_key"
ON "TrialFeedback"("trialBookingId");

-- CreateIndex
CREATE INDEX "TrialFeedback_parentId_createdAt_idx"
ON "TrialFeedback"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "TrialFeedback_completedAt_adminNotifiedAt_idx"
ON "TrialFeedback"("completedAt", "adminNotifiedAt");

-- AddForeignKey
ALTER TABLE "TrialFeedback"
ADD CONSTRAINT "TrialFeedback_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialFeedback"
ADD CONSTRAINT "TrialFeedback_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
