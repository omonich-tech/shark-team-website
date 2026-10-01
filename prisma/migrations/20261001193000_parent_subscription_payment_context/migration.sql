ALTER TABLE "TelegramContact"
ADD COLUMN "selectedSubscriptionPaymentId" TEXT;

CREATE INDEX "TelegramContact_selectedSubscriptionPaymentId_idx"
ON "TelegramContact"("selectedSubscriptionPaymentId");

ALTER TABLE "TelegramContact"
ADD CONSTRAINT "TelegramContact_selectedSubscriptionPaymentId_fkey"
FOREIGN KEY ("selectedSubscriptionPaymentId")
REFERENCES "SubscriptionPayment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
