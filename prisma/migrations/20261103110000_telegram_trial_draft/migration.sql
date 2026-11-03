CREATE TABLE "TelegramTrialDraft" (
  "telegramUserId" BIGINT NOT NULL,
  "chatId" BIGINT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'ru',
  "step" TEXT NOT NULL DEFAULT 'sport',
  "sportId" TEXT,
  "branchId" TEXT,
  "childAge" INTEGER,
  "sessionId" TEXT,
  "parentName" TEXT,
  "childName" TEXT,
  "phone" TEXT,
  "leadId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramTrialDraft_pkey" PRIMARY KEY ("telegramUserId")
);
