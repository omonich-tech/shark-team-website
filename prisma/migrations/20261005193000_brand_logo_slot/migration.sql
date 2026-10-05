INSERT INTO "ContentPage" (
  "id", "slug", "status", "publishedAt", "createdAt", "updatedAt"
)
VALUES (
  'PAGE-BRAND-01',
  'brand',
  'PUBLISHED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
