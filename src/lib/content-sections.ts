import type { PublicLocale } from "@/lib/public-i18n";

export type ContentSections = Record<string, string>;

export function parseContentSections(value: unknown): ContentSections {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: ContentSections = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }

  return result;
}

export function sectionText(
  sections: ContentSections,
  key: string,
  locale: PublicLocale,
  fallback: string
) {
  const localizedKey = key + (locale === "ru" ? "Ru" : "Uz");
  const value = sections[localizedKey]?.trim();
  return value || fallback;
}


export const CONTENT_SECTION_DEFAULTS = {
  home: {
    sportsTitleRu: "Больше, чем одна команда",
    sportsTitleUz: "Bitta jamoadan ko‘proq",
    sportsLeadRu:
      "Спортивные направления SHARK TEAM. Одна философия: движение, характер, дисциплина и уверенность.",
    sportsLeadUz:
      "SHARK TEAM sport yo‘nalishlari. Bitta falsafa: harakat, xarakter, intizom va ishonch.",
    whyTitleRu: "Почему выбирают SHARK TEAM",
    whyTitleUz: "Nega SHARK TEAM tanlanadi",
    benefit1TitleRu: "Профессиональные тренеры",
    benefit1TitleUz: "Professional murabbiylar",
    benefit1BodyRu:
      "Специалисты, которые умеют работать с детьми и давать понятную обратную связь.",
    benefit1BodyUz:
      "Bolalar bilan ishlay oladigan va tushunarli fikr-mulohaza beradigan mutaxassislar.",
    benefit2TitleRu: "Комплексное развитие",
    benefit2TitleUz: "Kompleks rivojlanish",
    benefit2BodyRu:
      "Физическая форма, координация, дисциплина, уверенность и командные навыки.",
    benefit2BodyUz:
      "Jismoniy tayyorgarlik, koordinatsiya, intizom, ishonch va jamoaviy ko‘nikmalar.",
    benefit3TitleRu: "Безопасная среда",
    benefit3TitleUz: "Xavfsiz muhit",
    benefit3BodyRu:
      "Понятные группы по возрасту, контролируемая нагрузка и прозрачная коммуникация.",
    benefit3BodyUz:
      "Yosh bo‘yicha tushunarli guruhlar, nazorat qilinadigan yuklama va ochiq muloqot.",
    benefit4TitleRu: "Дружелюбная атмосфера",
    benefit4TitleUz: "Do‘stona atmosfera",
    benefit4BodyRu:
      "Ребёнок становится частью команды и хочет возвращаться на тренировку.",
    benefit4BodyUz:
      "Bola jamoaning bir qismiga aylanadi va mashg‘ulotga qaytishni xohlaydi.",
    coachesTitleRu: "Наши тренеры",
    coachesTitleUz: "Murabbiylarimiz",
    branchesTitleRu: "Наши филиалы",
    branchesTitleUz: "Filiallarimiz",
    trialTitleRu: "Как проходит пробное занятие",
    trialTitleUz: "Sinov mashg‘uloti qanday o‘tadi",
    trial1TitleRu: "Вы выбираете спорт",
    trial1TitleUz: "Sport turini tanlaysiz",
    trial1BodyRu: "Смотрите направления и доступные филиалы.",
    trial1BodyUz: "Yo‘nalishlar va mavjud filiallarni ko‘rasiz.",
    trial2TitleRu: "Мы подбираем группу",
    trial2TitleUz: "Mos guruhni topamiz",
    trial2BodyRu: "Система учитывает возраст и свободные занятия.",
    trial2BodyUz: "Tizim yosh va bo‘sh mashg‘ulotlarni hisobga oladi.",
    trial3TitleRu: "Ребёнок приходит на пробное",
    trial3TitleUz: "Bola sinovga keladi",
    trial3BodyRu: "Знакомится с тренером, командой и форматом.",
    trial3BodyUz: "Murabbiy, jamoa va format bilan tanishadi.",
    trial4TitleRu: "Вы принимаете решение",
    trial4TitleUz: "Qaror qabul qilasiz",
    trial4BodyRu: "После занятия можно продолжить без обязательств.",
    trial4BodyUz: "Mashg‘ulotdan so‘ng davom ettirish majburiy emas.",
    faqTitleRu: "Часто задаваемые вопросы",
    faqTitleUz: "Ko‘p so‘raladigan savollar",
    ctaTitleRu: "Готовы к новым достижениям?",
    ctaTitleUz: "Yangi yutuqlarga tayyormisiz?",
    ctaLeadRu:
      "Выберите вид спорта и сделайте первый шаг вместе с SHARK TEAM.",
    ctaLeadUz:
      "Sport turini tanlang va SHARK TEAM bilan birinchi qadamni qo‘ying."
  },
  about: {
    storyEyebrowRu: "НАШ ПОДХОД",
    storyEyebrowUz: "BIZNING YONDASHUV",
    storyTitleRu: "Среда, в которой ребёнок растёт через спорт",
    storyTitleUz: "Bola sport orqali rivojlanadigan muhit",
    principlesEyebrowRu: "ПРИНЦИПЫ",
    principlesEyebrowUz: "TAMOYILLAR",
    principlesTitleRu: "Что мы хотим дать ребёнку",
    principlesTitleUz: "Bolaga nima berishni istaymiz",
    principle1TitleRu: "Развитие",
    principle1TitleUz: "Rivojlanish",
    principle1BodyRu:
      "Не только техника спорта, но и координация, физическая база, уверенность и самостоятельность.",
    principle1BodyUz:
      "Faqat sport texnikasi emas, balki koordinatsiya, jismoniy baza, ishonch va mustaqillik.",
    principle2TitleRu: "Дисциплина",
    principle2TitleUz: "Intizom",
    principle2BodyRu:
      "Регулярность, понятные правила и уважение к тренеру, команде и собственному прогрессу.",
    principle2BodyUz:
      "Muntazamlik, tushunarli qoidalar va murabbiy, jamoa hamda o‘z rivojlanishiga hurmat.",
    principle3TitleRu: "Команда",
    principle3TitleUz: "Jamoa",
    principle3BodyRu:
      "Ребёнок тренируется среди сверстников и учится взаимодействовать, поддерживать и брать ответственность.",
    principle3BodyUz:
      "Bola tengdoshlari bilan mashq qiladi, hamkorlik, qo‘llab-quvvatlash va mas’uliyatni o‘rganadi.",
    principle4TitleRu: "Безопасная среда",
    principle4TitleUz: "Xavfsiz muhit",
    principle4BodyRu:
      "Возрастные группы, контролируемая нагрузка и прозрачная коммуникация с родителем.",
    principle4BodyUz:
      "Yosh guruhlari, nazorat qilinadigan yuklama va ota-ona bilan ochiq muloqot.",
    ctaTitleRu: "Найдите спорт, который подойдёт вашему ребёнку",
    ctaTitleUz: "Farzandingizga mos sport turini toping",
    ctaLeadRu:
      "Выберите направление, филиал и удобную дату пробного занятия.",
    ctaLeadUz:
      "Yo‘nalish, filial va qulay sinov sanasini tanlang."
  },
  contacts: {
    channelsEyebrowRu: "СВЯЗАТЬСЯ",
    channelsEyebrowUz: "BOG‘LANISH",
    channelsTitleRu: "Выберите удобный канал",
    channelsTitleUz: "Qulay aloqa kanalini tanlang",
    branchesEyebrowRu: "ФИЛИАЛЫ",
    branchesEyebrowUz: "FILIALLAR",
    branchesTitleRu: "Активные локации SHARK TEAM",
    branchesTitleUz: "Faol SHARK TEAM manzillari",
    ctaTitleRu: "Хотите сразу подобрать пробное занятие?",
    ctaTitleUz: "Sinov mashg‘ulotini darhol tanlamoqchimisiz?",
    ctaLeadRu:
      "Выберите спорт, филиал, возраст ребёнка и свободную дату.",
    ctaLeadUz:
      "Sport turi, filial, bolaning yoshi va bo‘sh sanani tanlang."
  }
} satisfies Record<string, ContentSections>;

export function contentSectionsWithDefaults(
  page: keyof typeof CONTENT_SECTION_DEFAULTS,
  value: unknown
): ContentSections {
  return {
    ...CONTENT_SECTION_DEFAULTS[page],
    ...parseContentSections(value)
  };
}
