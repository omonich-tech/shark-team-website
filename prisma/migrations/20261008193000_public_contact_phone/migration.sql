UPDATE "Branch"
SET
  "publicPhone" = '+998 90 187 45 01',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'BR-SCHOOL-117-01';

UPDATE "ContentPage"
SET
  "contactPhone" = '+998 90 187 45 01',
  "contactTelegram" = 'https://t.me/sharkteam_uz_bot',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'contacts';
