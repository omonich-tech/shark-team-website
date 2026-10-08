-- Local SEO master data for SHARK TEAM School 117.
-- Address and coordinates verified against current public map data.
UPDATE "Branch"
SET
  "latitude" = 41.352103,
  "longitude" = 69.298296,
  "seoTitleRu" = 'Баскетбол для детей на Юнусабаде — SHARK TEAM, Школа №117',
  "seoTitleUz" = 'Yunusobodda bolalar basketboli — SHARK TEAM, 117-maktab',
  "seoDescriptionRu" = 'Детская секция баскетбола SHARK TEAM в Юнусабадском районе Ташкента, рядом с метро «Шахристан». Школа №117, ул. Хитой, 9. Группы 6–15 лет, Вт/Чт/Сб.',
  "seoDescriptionUz" = 'Toshkent Yunusobod tumanidagi SHARK TEAM bolalar basketbol seksiyasi, «Shahriston» metrosi yaqinida. 117-maktab, Xitoy ko‘chasi, 9. 6–15 yosh, Sesh/Pay/Shan.',
  "facilityNotesRu" = 'Детская секция баскетбола SHARK TEAM на Юнусабаде. Тренировки проходят в спортивном зале школы №117 рядом с метро «Шахристан».',
  "facilityNotesUz" = 'Yunusoboddagi SHARK TEAM bolalar basketbol seksiyasi. Mashg‘ulotlar «Shahriston» metrosi yaqinidagi 117-maktab sport zalida o‘tadi.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'BR-SCHOOL-117-01';



INSERT INTO "FaqItem"
  ("id", "status", "branchId", "sportId", "questionRu", "questionUz", "answerRu", "answerUz", "sortOrder", "createdAt", "updatedAt")
SELECT
  faq."id",
  'PUBLISHED'::"ContentStatus",
  branch."id",
  NULL,
  faq."questionRu",
  faq."questionUz",
  faq."answerRu",
  faq."answerUz",
  faq."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Branch" AS branch
CROSS JOIN (
  VALUES
    (
      'FAQ-S117-LOCATION-01',
      'Где находится секция баскетбола SHARK TEAM на Юнусабаде?',
      'Yunusoboddagi SHARK TEAM basketbol seksiyasi qayerda joylashgan?',
      'Тренировки проходят в спортивном зале школы №117: ул. Хитой, 9, Юнусабадский район, Ташкент, рядом с метро «Шахристан».',
      'Mashg‘ulotlar 117-maktab sport zalida o‘tadi: Xitoy ko‘chasi, 9, Yunusobod tumani, Toshkent, «Shahriston» metro bekati yaqinida.',
      10
    ),
    (
      'FAQ-S117-AGE-01',
      'Для какого возраста подходит баскетбол в школе №117?',
      '117-maktabdagi basketbol qaysi yoshdagilar uchun?',
      'В филиале работают баскетбольные группы для детей от 6 до 15 лет. Ребёнка подбирают в группу по возрасту.',
      'Filialda 6 yoshdan 15 yoshgacha bo‘lgan bolalar uchun basketbol guruhlari mavjud. Bola yoshiga mos guruhga joylashtiriladi.',
      20
    ),
    (
      'FAQ-S117-SCHEDULE-01',
      'Когда проходят тренировки по баскетболу на Юнусабаде?',
      'Yunusobodda basketbol mashg‘ulotlari qachon o‘tadi?',
      'Тренировки проходят по вторникам, четвергам и субботам с 17:00 до 20:00. Конкретное время зависит от возрастной группы.',
      'Mashg‘ulotlar seshanba, payshanba va shanba kunlari 17:00 dan 20:00 gacha o‘tadi. Aniq vaqt yosh guruhiga bog‘liq.',
      30
    ),
    (
      'FAQ-S117-TRIAL-01',
      'Можно ли записаться на пробное занятие?',
      'Sinov mashg‘ulotiga yozilish mumkinmi?',
      'Да. На странице филиала можно выбрать пробное занятие, подходящую возрастную группу и доступное время.',
      'Ha. Filial sahifasida sinov mashg‘ulotini, yoshga mos guruhni va mavjud vaqtni tanlash mumkin.',
      40
    )
) AS faq("id", "questionRu", "questionUz", "answerRu", "answerUz", "sortOrder")
WHERE branch."id" = 'BR-SCHOOL-117-01'
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "branchId" = EXCLUDED."branchId",
  "sportId" = EXCLUDED."sportId",
  "questionRu" = EXCLUDED."questionRu",
  "questionUz" = EXCLUDED."questionUz",
  "answerRu" = EXCLUDED."answerRu",
  "answerUz" = EXCLUDED."answerUz",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
