ALTER TABLE "ContentPage"
ADD COLUMN "sectionsJson" JSONB;

-- Legacy FAQ was historically hard-coded to School 117 + Basketball
-- while being rendered as the global FAQ on the home page.
UPDATE "FaqItem"
SET "branchId" = NULL,
    "sportId" = NULL
WHERE "branchId" = 'BR-SCHOOL-117-01'
  AND "sportId" = 'SP-BASKETBALL-01';
