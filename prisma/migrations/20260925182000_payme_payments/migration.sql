-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'TRIAL_CONFIRMED';

-- AlterEnum
ALTER TYPE "TrialBookingStatus" ADD VALUE 'PAYMENT_PENDING' AFTER 'HOLD';

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYME');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'CANCELLED',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "trialBookingId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYME',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountUzs" INTEGER NOT NULL,
    "amountTiyin" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymeTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "requestTime" BIGINT NOT NULL,
    "amountTiyin" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "reason" INTEGER,
    "merchantCreateTime" TIMESTAMP(3) NOT NULL,
    "merchantPerformTime" TIMESTAMP(3),
    "merchantCancelTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_trialBookingId_key"
ON "Payment"("trialBookingId");

-- CreateIndex
CREATE INDEX "Payment_provider_status_idx"
ON "Payment"("provider", "status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx"
ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymeTransaction_providerTransactionId_key"
ON "PaymeTransaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "PaymeTransaction_paymentId_state_idx"
ON "PaymeTransaction"("paymentId", "state");

-- CreateIndex
CREATE INDEX "PaymeTransaction_requestTime_idx"
ON "PaymeTransaction"("requestTime");

-- AddForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymeTransaction"
ADD CONSTRAINT "PaymeTransaction_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
