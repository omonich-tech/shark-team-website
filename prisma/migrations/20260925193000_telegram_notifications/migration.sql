-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'PAYMENT_HOLD_REMINDER',
  'TRIAL_CONFIRMED',
  'TRIAL_REMINDER',
  'POST_TRIAL_FEEDBACK'
);

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

-- CreateTable
CREATE TABLE "TelegramContact" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "parentId" TEXT,
    "telegramUserId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "languageCode" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'TELEGRAM',
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "parentId" TEXT,
    "trialBookingId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalMessageId" TEXT,
    "lastError" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramContact_telegramUserId_key"
ON "TelegramContact"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramContact_chatId_key"
ON "TelegramContact"("chatId");

-- CreateIndex
CREATE INDEX "TelegramContact_leadId_idx"
ON "TelegramContact"("leadId");

-- CreateIndex
CREATE INDEX "TelegramContact_parentId_idx"
ON "TelegramContact"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key"
ON "TelegramLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_leadId_expiresAt_idx"
ON "TelegramLinkToken"("leadId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key"
ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx"
ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_leadId_idx"
ON "Notification"("leadId");

-- CreateIndex
CREATE INDEX "Notification_parentId_idx"
ON "Notification"("parentId");

-- CreateIndex
CREATE INDEX "Notification_trialBookingId_idx"
ON "Notification"("trialBookingId");

-- AddForeignKey
ALTER TABLE "TelegramContact"
ADD CONSTRAINT "TelegramContact_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramContact"
ADD CONSTRAINT "TelegramContact_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkToken"
ADD CONSTRAINT "TelegramLinkToken_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_trialBookingId_fkey"
FOREIGN KEY ("trialBookingId") REFERENCES "TrialBooking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
