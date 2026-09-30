-- CreateEnum
CREATE TYPE "TrialConversionStatus" AS ENUM (
  'READY',
  'THINKING',
  'OFFERED',
  'PAYMENT_PENDING',
  'ENROLLED',
  'DECLINED'
);

-- CreateTable
CREATE TABLE "TrialConversion" (
    "id" TEXT NOT NULL,
    "trialBookingId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "status" "TrialConversionStatus" NOT NULL DEFAULT 'READY',
    "amountUzs" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "offeredAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "trialConversionId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL_CARD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountUzs" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "receiptMimeType" TEXT,
    "receiptSize" INTEGER,
    "receiptTelegramFileId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialConversion_trialBookingId_key"
ON "TrialConversion"("trialBookingId");

CREATE INDEX "TrialConversion_status_updatedAt_idx"
ON "TrialConversion"("status", "updatedAt");

CREATE INDEX "TrialConversion_childId_status_idx"
ON "TrialConversion"("childId", "status");

CREATE INDEX "TrialConversion_groupId_status_idx"
ON "TrialConversion"("groupId", "status");

CREATE UNIQUE INDEX "SubscriptionPayment_trialConversionId_key"
ON "SubscriptionPayment"("trialConversionId");

CREATE INDEX "SubscriptionPayment_provider_status_idx"
ON "SubscriptionPayment"("provider", "status");

CREATE INDEX "SubscriptionPayment_status_submittedAt_idx"
ON "SubscriptionPayment"("status", "submittedAt");

-- AddForeignKey
ALTER TABLE "TrialConversion"
ADD CONSTRAINT "TrialConversion_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrialConversion"
ADD CONSTRAINT "TrialConversion_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrialConversion"
ADD CONSTRAINT "TrialConversion_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment"
ADD CONSTRAINT "SubscriptionPayment_trialConversionId_fkey"
FOREIGN KEY ("trialConversionId") REFERENCES "TrialConversion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
