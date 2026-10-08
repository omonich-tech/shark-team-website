import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentStatus,
  EnrollmentStatus,
  LifecycleStatus,
  PriceProductType,
  PrismaClient,
  Weekday
} from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

const SPORT_ID = "SP-BASKETBALL-01";
const BRANCH_ID = "BR-SCHOOL-117-01";
const COACH_ID = "CO-0001";

const groups = [
  {
    id: "GR-BASK-S117-0608-01",
    internalName: "Basketball 6-8",
    ageMin: 6,
    ageMax: 8,
    startMinutes: 17 * 60,
    endMinutes: 18 * 60
  },
  {
    id: "GR-BASK-S117-0911-01",
    internalName: "Basketball 9-11",
    ageMin: 9,
    ageMax: 11,
    startMinutes: 18 * 60,
    endMinutes: 19 * 60
  },
  {
    id: "GR-BASK-S117-1215-01",
    internalName: "Basketball 12-15",
    ageMin: 12,
    ageMax: 15,
    startMinutes: 19 * 60,
    endMinutes: 20 * 60
  }
] as const;

const trainingDays = [
  Weekday.TUESDAY,
  Weekday.THURSDAY,
  Weekday.SATURDAY
] as const;

async function main() {
  await prisma.sport.upsert({
    where: { id: SPORT_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      nameRu: "Баскетбол",
      nameUz: "Basketbol",
      ageMin: 6,
      ageMax: 15,
      sortOrder: 1,
      shortDescriptionRu: "Командная игра, координация и уверенность.",
      shortDescriptionUz: "Jamoaviy o‘yin, koordinatsiya va ishonch."
    },
    create: {
      id: SPORT_ID,
      slug: "basketball",
      status: LifecycleStatus.ACTIVE,
      nameRu: "Баскетбол",
      nameUz: "Basketbol",
      ageMin: 6,
      ageMax: 15,
      sortOrder: 1,
      shortDescriptionRu: "Командная игра, координация и уверенность.",
      shortDescriptionUz: "Jamoaviy o‘yin, koordinatsiya va ishonch."
    }
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      publicNameRu: "SHARK TEAM — Школа №117",
      publicNameUz: "SHARK TEAM — 117-maktab",
      districtRu: "Юнусабадский район",
      districtUz: "Yunusobod tumani",
      addressRu: "ул. Хитой, 9, Ташкент",
      addressUz: "Xitoy ko‘chasi, 9, Toshkent",
      postalCode: "100099",
      landmarkRu: "Метро «Шахристан»",
      landmarkUz: "«Shahriston» metro bekati",
      latitude: 41.352103,
      longitude: 69.298296,
      seoTitleRu: "Баскетбол для детей на Юнусабаде — SHARK TEAM, Школа №117",
      seoTitleUz: "Yunusobodda bolalar basketboli — SHARK TEAM, 117-maktab",
      seoDescriptionRu:
        "Детская секция баскетбола SHARK TEAM в Юнусабадском районе Ташкента, рядом с метро «Шахристан». Школа №117, ул. Хитой, 9. Группы 6–15 лет, Вт/Чт/Сб.",
      seoDescriptionUz:
        "Toshkent Yunusobod tumanidagi SHARK TEAM bolalar basketbol seksiyasi, «Shahriston» metrosi yaqinida. 117-maktab, Xitoy ko‘chasi, 9. 6–15 yosh, Sesh/Pay/Shan.",
      workingHoursRu: "Вт / Чт / Сб, 17:00–20:00",
      workingHoursUz: "Sesh / Pay / Shan, 17:00–20:00",
      facilityNotesRu:
        "Детская секция баскетбола SHARK TEAM на Юнусабаде. Тренировки проходят в спортивном зале школы №117 рядом с метро «Шахристан».",
      facilityNotesUz:
        "Yunusoboddagi SHARK TEAM bolalar basketbol seksiyasi. Mashg‘ulotlar «Shahriston» metrosi yaqinidagi 117-maktab sport zalida o‘tadi."
    },
    create: {
      id: BRANCH_ID,
      slug: "school-117",
      status: LifecycleStatus.ACTIVE,
      internalName: "Школа №117",
      publicNameRu: "SHARK TEAM — Школа №117",
      publicNameUz: "SHARK TEAM — 117-maktab",
      districtRu: "Юнусабадский район",
      districtUz: "Yunusobod tumani",
      addressRu: "ул. Хитой, 9, Ташкент",
      addressUz: "Xitoy ko‘chasi, 9, Toshkent",
      postalCode: "100099",
      landmarkRu: "Метро «Шахристан»",
      landmarkUz: "«Shahriston» metro bekati",
      latitude: 41.352103,
      longitude: 69.298296,
      seoTitleRu: "Баскетбол для детей на Юнусабаде — SHARK TEAM, Школа №117",
      seoTitleUz: "Yunusobodda bolalar basketboli — SHARK TEAM, 117-maktab",
      seoDescriptionRu:
        "Детская секция баскетбола SHARK TEAM в Юнусабадском районе Ташкента, рядом с метро «Шахристан». Школа №117, ул. Хитой, 9. Группы 6–15 лет, Вт/Чт/Сб.",
      seoDescriptionUz:
        "Toshkent Yunusobod tumanidagi SHARK TEAM bolalar basketbol seksiyasi, «Shahriston» metrosi yaqinida. 117-maktab, Xitoy ko‘chasi, 9. 6–15 yosh, Sesh/Pay/Shan.",
      workingHoursRu: "Вт / Чт / Сб, 17:00–20:00",
      workingHoursUz: "Sesh / Pay / Shan, 17:00–20:00",
      facilityNotesRu:
        "Детская секция баскетбола SHARK TEAM на Юнусабаде. Тренировки проходят в спортивном зале школы №117 рядом с метро «Шахристан».",
      facilityNotesUz:
        "Yunusoboddagi SHARK TEAM bolalar basketbol seksiyasi. Mashg‘ulotlar «Shahriston» metrosi yaqinidagi 117-maktab sport zalida o‘tadi."
    }
  });

  await prisma.coach.upsert({
    where: { id: COACH_ID },
    update: {
      status: LifecycleStatus.ACTIVE,
      firstName: "Дилшод"
    },
    create: {
      id: COACH_ID,
      status: LifecycleStatus.ACTIVE,
      firstName: "Дилшод"
    }
  });

  await prisma.branchSport.upsert({
    where: {
      branchId_sportId: {
        branchId: BRANCH_ID,
        sportId: SPORT_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      branchId: BRANCH_ID,
      sportId: SPORT_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.coachSport.upsert({
    where: {
      coachId_sportId: {
        coachId: COACH_ID,
        sportId: SPORT_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      coachId: COACH_ID,
      sportId: SPORT_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.coachBranch.upsert({
    where: {
      coachId_branchId: {
        coachId: COACH_ID,
        branchId: BRANCH_ID
      }
    },
    update: { status: LifecycleStatus.ACTIVE },
    create: {
      coachId: COACH_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  for (const group of groups) {
    await prisma.trainingGroup.upsert({
      where: { id: group.id },
      update: {
        branchId: BRANCH_ID,
        sportId: SPORT_ID,
        primaryCoachId: COACH_ID,
        internalName: group.internalName,
        status: LifecycleStatus.ACTIVE,
        enrollmentStatus: EnrollmentStatus.OPEN,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        capacityRegular: 20
      },
      create: {
        id: group.id,
        branchId: BRANCH_ID,
        sportId: SPORT_ID,
        primaryCoachId: COACH_ID,
        internalName: group.internalName,
        status: LifecycleStatus.ACTIVE,
        enrollmentStatus: EnrollmentStatus.OPEN,
        ageMin: group.ageMin,
        ageMax: group.ageMax,
        capacityRegular: 20,
        capacityTrial: null
      }
    });

    for (const weekday of trainingDays) {
      const ruleId = `RULE-${group.id}-${weekday}`;

      await prisma.groupScheduleRule.upsert({
        where: { id: ruleId },
        update: {
          weekday,
          startMinutes: group.startMinutes,
          endMinutes: group.endMinutes,
          status: LifecycleStatus.ACTIVE
        },
        create: {
          id: ruleId,
          groupId: group.id,
          weekday,
          startMinutes: group.startMinutes,
          endMinutes: group.endMinutes,
          status: LifecycleStatus.ACTIVE
        }
      });
    }
  }

  await prisma.price.upsert({
    where: { id: "PRICE-BASK-S117-TRIAL-01" },
    update: {
      amount: 50000,
      currency: "UZS",
      status: LifecycleStatus.ACTIVE
    },
    create: {
      id: "PRICE-BASK-S117-TRIAL-01",
      productType: PriceProductType.TRIAL,
      amount: 50000,
      currency: "UZS",
      sportId: SPORT_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  await prisma.price.upsert({
    where: { id: "PRICE-BASK-S117-SUBSCRIPTION-01" },
    update: {
      amount: 500000,
      currency: "UZS",
      status: LifecycleStatus.ACTIVE
    },
    create: {
      id: "PRICE-BASK-S117-SUBSCRIPTION-01",
      productType: PriceProductType.SUBSCRIPTION,
      amount: 500000,
      currency: "UZS",
      sportId: SPORT_ID,
      branchId: BRANCH_ID,
      status: LifecycleStatus.ACTIVE
    }
  });

  const branchFaqItems = [
    {
      id: "FAQ-S117-LOCATION-01",
      questionRu: "Где находится секция баскетбола SHARK TEAM на Юнусабаде?",
      questionUz: "Yunusoboddagi SHARK TEAM basketbol seksiyasi qayerda joylashgan?",
      answerRu:
        "Тренировки проходят в спортивном зале школы №117: ул. Хитой, 9, Юнусабадский район, Ташкент, рядом с метро «Шахристан».",
      answerUz:
        "Mashg‘ulotlar 117-maktab sport zalida o‘tadi: Xitoy ko‘chasi, 9, Yunusobod tumani, Toshkent, «Shahriston» metro bekati yaqinida.",
      sortOrder: 10
    },
    {
      id: "FAQ-S117-AGE-01",
      questionRu: "Для какого возраста подходит баскетбол в школе №117?",
      questionUz: "117-maktabdagi basketbol qaysi yoshdagilar uchun?",
      answerRu:
        "В филиале работают баскетбольные группы для детей от 6 до 15 лет. Ребёнка подбирают в группу по возрасту.",
      answerUz:
        "Filialda 6 yoshdan 15 yoshgacha bo‘lgan bolalar uchun basketbol guruhlari mavjud. Bola yoshiga mos guruhga joylashtiriladi.",
      sortOrder: 20
    },
    {
      id: "FAQ-S117-SCHEDULE-01",
      questionRu: "Когда проходят тренировки по баскетболу на Юнусабаде?",
      questionUz: "Yunusobodda basketbol mashg‘ulotlari qachon o‘tadi?",
      answerRu:
        "Тренировки проходят по вторникам, четвергам и субботам с 17:00 до 20:00. Конкретное время зависит от возрастной группы.",
      answerUz:
        "Mashg‘ulotlar seshanba, payshanba va shanba kunlari 17:00 dan 20:00 gacha o‘tadi. Aniq vaqt yosh guruhiga bog‘liq.",
      sortOrder: 30
    },
    {
      id: "FAQ-S117-TRIAL-01",
      questionRu: "Можно ли записаться на пробное занятие?",
      questionUz: "Sinov mashg‘ulotiga yozilish mumkinmi?",
      answerRu:
        "Да. На странице филиала можно выбрать пробное занятие, подходящую возрастную группу и доступное время.",
      answerUz:
        "Ha. Filial sahifasida sinov mashg‘ulotini, yoshga mos guruhni va mavjud vaqtni tanlash mumkin.",
      sortOrder: 40
    }
  ] as const;

  for (const item of branchFaqItems) {
    await prisma.faqItem.upsert({
      where: { id: item.id },
      update: {
        status: ContentStatus.PUBLISHED,
        branchId: BRANCH_ID,
        sportId: null,
        questionRu: item.questionRu,
        questionUz: item.questionUz,
        answerRu: item.answerRu,
        answerUz: item.answerUz,
        sortOrder: item.sortOrder
      },
      create: {
        id: item.id,
        status: ContentStatus.PUBLISHED,
        branchId: BRANCH_ID,
        sportId: null,
        questionRu: item.questionRu,
        questionUz: item.questionUz,
        answerRu: item.answerRu,
        answerUz: item.answerUz,
        sortOrder: item.sortOrder
      }
    });
  }

  await prisma.contentPage.upsert({
    where: { slug: "brand" },
    update: {},
    create: {
      id: "PAGE-BRAND-01",
      slug: "brand",
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date()
    }
  });

  await prisma.contentPage.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      status: ContentStatus.PUBLISHED,
      heroEyebrowRu: "SHARK TEAM · ТАШКЕНТ",
      heroEyebrowUz: "SHARK TEAM · TOSHKENT",
      heroTitleRu: "Спорт, в который хочется возвращаться",
      heroTitleUz: "Qayta-qayta kelgingiz keladigan sport",
      heroLeadRu:
        "Спортивные секции для детей в Ташкенте. Баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика.",
      heroLeadUz:
        "Toshkentdagi bolalar sport seksiyalari. Basketbol, futbol, voleybol, yengil atletika va badiiy gimnastika.",
      seoTitleRu: "SHARK TEAM — детские спортивные секции в Ташкенте",
      seoTitleUz: "SHARK TEAM — Toshkentdagi bolalar sport seksiyalari",
      seoDescriptionRu:
        "SHARK TEAM — баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика для детей в Ташкенте.",
      seoDescriptionUz:
        "SHARK TEAM — Toshkentda bolalar uchun basketbol, futbol, voleybol, yengil atletika va badiiy gimnastika.",
      publishedAt: new Date()
    }
  });


  await prisma.contentPage.upsert({
    where: { slug: "about" },
    update: {},
    create: {
      id: "PAGE-ABOUT-01",
      slug: "about",
      status: ContentStatus.PUBLISHED,
      heroEyebrowRu: "О SHARK TEAM",
      heroEyebrowUz: "SHARK TEAM HAQIDA",
      heroTitleRu: "Спорт формирует больше, чем физическую форму",
      heroTitleUz: "Sport jismoniy tayyorgarlikdan ko‘proq narsani shakllantiradi",
      heroLeadRu:
        "SHARK TEAM — детская спортивная среда, где ребёнок тренируется, развивается и становится частью команды.",
      heroLeadUz:
        "SHARK TEAM — bola mashq qiladigan, rivojlanadigan va jamoaning bir qismiga aylanadigan sport muhiti.",
      bodyRu:
        "Мы строим SHARK TEAM как систему спортивных секций для детей в Ташкенте. Наша задача — дать ребёнку понятную, регулярную и безопасную спортивную среду: сильного тренера, подходящую возрастную группу, команду и возможность видеть собственный прогресс.\n\nМы не привязываем бренд к одному виду спорта. Ребёнок может выбрать направление, которое подходит ему по интересу, характеру и физическим данным, а родитель — видеть понятную организацию занятий и коммуникацию.",
      bodyUz:
        "SHARK TEAM’ni Toshkentdagi bolalar sport seksiyalari tizimi sifatida qurmoqdamiz. Maqsadimiz — bolaga tushunarli, muntazam va xavfsiz sport muhitini berish: kuchli murabbiy, yoshiga mos guruh, jamoa va o‘z rivojlanishini ko‘rish imkoniyati.\n\nBrendni bitta sport turi bilan cheklamaymiz. Bola qiziqishi, xarakteri va jismoniy imkoniyatlariga mos yo‘nalishni tanlashi, ota-ona esa mashg‘ulotlar va muloqot qanday tashkil etilganini aniq ko‘rishi mumkin.",
      seoTitleRu: "О SHARK TEAM — детские спортивные секции в Ташкенте",
      seoTitleUz: "SHARK TEAM haqida — Toshkentdagi bolalar sport seksiyalari",
      seoDescriptionRu:
        "Подход SHARK TEAM к детскому спорту, развитию, тренерам и спортивной среде.",
      seoDescriptionUz:
        "SHARK TEAM bolalar sporti, rivojlanish, murabbiylar va sport muhiti haqida.",
      publishedAt: new Date()
    }
  });

  await prisma.contentPage.upsert({
    where: { slug: "contacts" },
    update: {},
    create: {
      id: "PAGE-CONTACTS-01",
      slug: "contacts",
      status: ContentStatus.PUBLISHED,
      heroEyebrowRu: "СВЯЗЬ С SHARK TEAM",
      heroEyebrowUz: "SHARK TEAM BILAN ALOQA",
      heroTitleRu: "Контакты и филиалы",
      heroTitleUz: "Kontaktlar va filiallar",
      heroLeadRu:
        "Выберите удобный способ связи или найдите ближайший активный филиал SHARK TEAM.",
      heroLeadUz:
        "Qulay aloqa usulini tanlang yoki eng yaqin faol SHARK TEAM filialini toping.",
      bodyRu:
        "По вопросам записи, пробного занятия, расписания и оплаты можно связаться с SHARK TEAM через указанные каналы. Данные филиалов ниже обновляются автоматически из админки.",
      bodyUz:
        "Yozilish, sinov mashg‘uloti, jadval va to‘lov bo‘yicha SHARK TEAM bilan quyidagi kanallar orqali bog‘lanishingiz mumkin. Filiallar ma’lumotlari admin paneldan avtomatik yangilanadi.",
      contactTelegram: "https://t.me/sharkteam_uz_bot",
      seoTitleRu: "Контакты SHARK TEAM — спортивные секции в Ташкенте",
      seoTitleUz: "SHARK TEAM kontaktlari — Toshkentdagi sport seksiyalari",
      seoDescriptionRu:
        "Контакты, филиалы и способы связи с SHARK TEAM в Ташкенте.",
      seoDescriptionUz:
        "Toshkentdagi SHARK TEAM kontaktlari, filiallari va aloqa usullari.",
      publishedAt: new Date()
    }
  });

  console.log("Seeded SHARK TEAM School 117 core data.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
