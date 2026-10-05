ALTER TABLE "ContentPage"
  ADD COLUMN "bodyRu" TEXT,
  ADD COLUMN "bodyUz" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "contactTelegram" TEXT,
  ADD COLUMN "contactInstagram" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactHoursRu" TEXT,
  ADD COLUMN "contactHoursUz" TEXT;

INSERT INTO "ContentPage" (
  "id", "slug", "status",
  "heroEyebrowRu", "heroEyebrowUz",
  "heroTitleRu", "heroTitleUz",
  "heroLeadRu", "heroLeadUz",
  "bodyRu", "bodyUz",
  "seoTitleRu", "seoTitleUz",
  "seoDescriptionRu", "seoDescriptionUz",
  "publishedAt", "createdAt", "updatedAt"
)
VALUES
(
  'PAGE-ABOUT-01',
  'about',
  'PUBLISHED',
  'О SHARK TEAM',
  'SHARK TEAM HAQIDA',
  'Спорт формирует больше, чем физическую форму',
  'Sport jismoniy tayyorgarlikdan ko‘proq narsani shakllantiradi',
  'SHARK TEAM — детская спортивная среда, где ребёнок тренируется, развивается и становится частью команды.',
  'SHARK TEAM — bola mashq qiladigan, rivojlanadigan va jamoaning bir qismiga aylanadigan sport muhiti.',
  E'Мы строим SHARK TEAM как систему спортивных секций для детей в Ташкенте. Наша задача — дать ребёнку понятную, регулярную и безопасную спортивную среду: сильного тренера, подходящую возрастную группу, команду и возможность видеть собственный прогресс.\n\nМы не привязываем бренд к одному виду спорта. Ребёнок может выбрать направление, которое подходит ему по интересу, характеру и физическим данным, а родитель — видеть понятную организацию занятий и коммуникацию.',
  E'SHARK TEAM’ni Toshkentdagi bolalar sport seksiyalari tizimi sifatida qurmoqdamiz. Maqsadimiz — bolaga tushunarli, muntazam va xavfsiz sport muhitini berish: kuchli murabbiy, yoshiga mos guruh, jamoa va o‘z rivojlanishini ko‘rish imkoniyati.\n\nBrendni bitta sport turi bilan cheklamaymiz. Bola qiziqishi, xarakteri va jismoniy imkoniyatlariga mos yo‘nalishni tanlashi, ota-ona esa mashg‘ulotlar va muloqot qanday tashkil etilganini aniq ko‘rishi mumkin.',
  'О SHARK TEAM — детские спортивные секции в Ташкенте',
  'SHARK TEAM haqida — Toshkentdagi bolalar sport seksiyalari',
  'Подход SHARK TEAM к детскому спорту, развитию, тренерам и спортивной среде.',
  'SHARK TEAM bolalar sporti, rivojlanish, murabbiylar va sport muhiti haqida.',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  'PAGE-CONTACTS-01',
  'contacts',
  'PUBLISHED',
  'СВЯЗЬ С SHARK TEAM',
  'SHARK TEAM BILAN ALOQA',
  'Контакты и филиалы',
  'Kontaktlar va filiallar',
  'Выберите удобный способ связи или найдите ближайший активный филиал SHARK TEAM.',
  'Qulay aloqa usulini tanlang yoki eng yaqin faol SHARK TEAM filialini toping.',
  'По вопросам записи, пробного занятия, расписания и оплаты можно связаться с SHARK TEAM через указанные каналы. Данные филиалов ниже обновляются автоматически из админки.',
  'Yozilish, sinov mashg‘uloti, jadval va to‘lov bo‘yicha SHARK TEAM bilan quyidagi kanallar orqali bog‘lanishingiz mumkin. Filiallar ma’lumotlari admin paneldan avtomatik yangilanadi.',
  'Контакты SHARK TEAM — спортивные секции в Ташкенте',
  'SHARK TEAM kontaktlari — Toshkentdagi sport seksiyalari',
  'Контакты, филиалы и способы связи с SHARK TEAM в Ташкенте.',
  'Toshkentdagi SHARK TEAM kontaktlari, filiallari va aloqa usullari.',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "ContentPage"
SET
  "contactTelegram" = COALESCE("contactTelegram", 'https://t.me/sharkteam_uz_bot'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'contacts';
