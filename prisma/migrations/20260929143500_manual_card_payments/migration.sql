-- Add manual card payments without removing the existing Payme integration.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'MANUAL_CARD';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'UNDER_REVIEW' AFTER 'PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED' AFTER 'PAID';

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "receiptUrl" TEXT,
ADD COLUMN "receiptPathname" TEXT,
ADD COLUMN "receiptMimeType" TEXT,
ADD COLUMN "receiptSize" INTEGER,
ADD COLUMN "receiptTelegramFileId" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "Payment_status_submittedAt_idx"
ON "Payment"("status", "submittedAt");
