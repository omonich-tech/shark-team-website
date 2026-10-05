-- Expand the public SHARK TEAM catalog from basketball-only to the planned
-- five-sport brand. Existing rows are preserved; named catalog entries are
-- updated to the canonical public copy.

INSERT INTO "Sport" (
  "id", "slug", "status", "nameRu", "nameUz",
  "shortDescriptionRu", "shortDescriptionUz", "sortOrder"
)
VALUES
  (
    'SP-FOOTBALL-01', 'football', 'ACTIVE', 'Футбол', 'Futbol',
    'Техника, скорость и командное мышление.',
    'Texnika, tezlik va jamoaviy fikrlash.',
    2
  ),
  (
    'SP-VOLLEYBALL-01', 'volleyball', 'ACTIVE', 'Волейбол', 'Voleybol',
    'Реакция, координация и работа в команде.',
    'Reaksiya, koordinatsiya va jamoada ishlash.',
    3
  ),
  (
    'SP-ATHLETICS-01', 'athletics', 'ACTIVE', 'Лёгкая атлетика', 'Yengil atletika',
    'Скорость, выносливость и сильная двигательная база.',
    'Tezlik, chidamlilik va kuchli harakat bazasi.',
    4
  ),
  (
    'SP-RHYTHMIC-GYMNASTICS-01', 'rhythmic-gymnastics', 'ACTIVE',
    'Художественная гимнастика', 'Badiiy gimnastika',
    'Гибкость, координация, дисциплина и грация.',
    'Egiluvchanlik, koordinatsiya, intizom va nafislik.',
    5
  )
ON CONFLICT ("slug") DO UPDATE SET
  "nameRu" = EXCLUDED."nameRu",
  "nameUz" = EXCLUDED."nameUz",
  "shortDescriptionRu" = COALESCE("Sport"."shortDescriptionRu", EXCLUDED."shortDescriptionRu"),
  "shortDescriptionUz" = COALESCE("Sport"."shortDescriptionUz", EXCLUDED."shortDescriptionUz"),
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Sport"
SET
  "shortDescriptionRu" = COALESCE(
    "shortDescriptionRu",
    'Командная игра, координация и уверенность.'
  ),
  "shortDescriptionUz" = COALESCE(
    "shortDescriptionUz",
    'Jamoaviy o‘yin, koordinatsiya va ishonch.'
  ),
  "sortOrder" = 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'basketball';

-- Upgrade only the original launch copy. Custom content edited later by the
-- owner is intentionally left untouched.
UPDATE "ContentPage"
SET
  "heroEyebrowRu" = 'SHARK TEAM · ТАШКЕНТ',
  "heroEyebrowUz" = 'SHARK TEAM · TOSHKENT',
  "heroTitleRu" = 'Спорт, в который хочется возвращаться',
  "heroTitleUz" = 'Qayta-qayta kelgingiz keladigan sport',
  "heroLeadRu" = 'Спортивные секции для детей в Ташкенте. Баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика.',
  "heroLeadUz" = 'Toshkentdagi bolalar sport seksiyalari. Basketbol, futbol, voleybol, yengil atletika va badiiy gimnastika.',
  "seoTitleRu" = 'SHARK TEAM — детские спортивные секции в Ташкенте',
  "seoTitleUz" = 'SHARK TEAM — Toshkentdagi bolalar sport seksiyalari',
  "seoDescriptionRu" = 'SHARK TEAM — баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика для детей в Ташкенте.',
  "seoDescriptionUz" = 'SHARK TEAM — Toshkentda bolalar uchun basketbol, futbol, voleybol, yengil atletika va badiiy gimnastika.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "slug" = 'home'
  AND (
    "heroTitleRu" IS NULL
    OR "heroTitleRu" = 'Баскетбол для детей в Ташкенте'
  );
