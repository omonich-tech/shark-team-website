export type SportStoryCard = {
  title: string;
  body: string;
};

export type SportStoryStep = {
  title: string;
  body: string;
};

export type SportStoryLocale = {
  heroLead: string;
  traits: string[];
  why: SportStoryCard[];
  physical: string[];
  character: string[];
  training: SportStoryStep[];
  skills: string[];
  fit: string[];
  beginner: string;
  ctaTitle: string;
  ctaLead: string;
};

export type SportCatalogEntry = {
  slug: string;
  nameRu: string;
  nameUz: string;
  descriptionRu: string;
  descriptionUz: string;
  mark: string;
  story: {
    ru: SportStoryLocale;
    uz: SportStoryLocale;
  };
};

export const SPORT_CATALOG: SportCatalogEntry[] = [
  {
    slug: "basketball",
    nameRu: "Баскетбол",
    nameUz: "Basketbol",
    descriptionRu: "Командная игра, координация и уверенность.",
    descriptionUz: "Jamoaviy o‘yin, koordinatsiya va ishonch.",
    mark: "01",
    story: {
      ru: {
        heroLead:
          "Игра, где за секунды нужно увидеть площадку, принять решение и действовать вместе с командой. Баскетбол постоянно держит ребёнка в движении и даёт очень понятное ощущение прогресса.",
        traits: ["Команда", "Скорость", "Координация", "Реакция", "Уверенность"],
        why: [
          {
            title: "Постоянно в игре",
            body: "Бег, передачи, ведение, броски и смена ролей не дают скучать — ребёнок почти всё время вовлечён в действие."
          },
          {
            title: "Прогресс видно",
            body: "Сегодня мяч уходит из рук, потом получается уверенное ведение, первая точная передача и первый чистый бросок."
          },
          {
            title: "Команда рядом",
            body: "Нужно видеть партнёров, договариваться, помогать в защите и понимать, что хороший момент создаётся вместе."
          },
          {
            title: "Игра учит думать быстро",
            body: "На площадке постоянно меняется ситуация: кому отдать пас, куда открыться, когда атаковать, а когда остановиться."
          }
        ],
        physical: [
          "координация рук и ног",
          "скорость и смена направления",
          "выносливость",
          "баланс и контроль тела",
          "реакция и точность движений"
        ],
        character: [
          "уверенность в своих действиях",
          "дисциплина",
          "ответственность за свою роль",
          "быстрое принятие решений",
          "командное взаимодействие"
        ],
        training: [
          {
            title: "Разогрев и движение",
            body: "Работа ног, координация, реакция и упражнения, которые готовят тело к игре."
          },
          {
            title: "Техника с мячом",
            body: "Ведение, передачи, остановки, повороты и броски — от простого к более игровому."
          },
          {
            title: "Игровые задания",
            body: "Упражнения один на один, два на два и ситуации, где нужно применять технику в движении."
          },
          {
            title: "Игра",
            body: "Ребёнок пробует принимать решения уже в настоящем игровом темпе и чувствует себя частью команды."
          }
        ],
        skills: [
          "контролировать мяч в движении",
          "точно передавать мяч партнёру",
          "правильно выполнять бросок",
          "двигаться без мяча и открываться",
          "играть в защите",
          "понимать базовые игровые ситуации"
        ],
        fit: [
          "любит активные игры и мяч",
          "хочет больше движения и динамики",
          "интересуется командными видами спорта",
          "хочет увереннее взаимодействовать со сверстниками",
          "любит видеть конкретный результат своих тренировок"
        ],
        beginner:
          "Не нужно заранее уметь вести мяч или попадать в кольцо. На первой тренировке важнее желание попробовать, слушать тренера и включаться в упражнения.",
        ctaTitle: "Баскетбол лучше один раз почувствовать, чем долго выбирать",
        ctaLead:
          "Пробное занятие покажет, нравится ли ребёнку темп игры, работа с мячом и атмосфера команды."
      },
      uz: {
        heroLead:
          "Bir necha soniya ichida maydonni ko‘rish, qaror qabul qilish va jamoa bilan birga harakat qilish kerak bo‘lgan o‘yin. Basketbol bolani doimo harakatda ushlab turadi va o‘sishni aniq his qilish imkonini beradi.",
        traits: ["Jamoa", "Tezlik", "Koordinatsiya", "Reaksiya", "Ishonch"],
        why: [
          {
            title: "Doimo o‘yinda",
            body: "Yugurish, pas, to‘p olib yurish, zarba va rollarning almashishi zerikishga vaqt qoldirmaydi."
          },
          {
            title: "Natija ko‘rinadi",
            body: "Avval to‘pni boshqarish qiyin bo‘ladi, keyin ishonchli dribling, aniq pas va birinchi chiroyli zarba paydo bo‘ladi."
          },
          {
            title: "Jamoa yoningizda",
            body: "Sheriklarni ko‘rish, kelishish, himoyada yordam berish va yaxshi vaziyat birgalikda yaratilishini tushunish kerak."
          },
          {
            title: "Tez fikrlashni o‘rgatadi",
            body: "Maydondagi vaziyat tez o‘zgaradi: kimga pas berish, qayerga ochilish, qachon hujum qilish kerakligini tanlash zarur."
          }
        ],
        physical: [
          "qo‘l va oyoq koordinatsiyasi",
          "tezlik va yo‘nalishni almashtirish",
          "chidamlilik",
          "muvozanat va tana nazorati",
          "reaksiya va harakat aniqligi"
        ],
        character: [
          "o‘z harakatiga ishonch",
          "intizom",
          "o‘z roliga mas’uliyat",
          "tez qaror qabul qilish",
          "jamoaviy hamkorlik"
        ],
        training: [
          {
            title: "Qizish va harakat",
            body: "Oyoq ishlashi, koordinatsiya, reaksiya va o‘yinga tayyorlovchi mashqlar."
          },
          {
            title: "To‘p bilan texnika",
            body: "Dribling, pas, to‘xtash, burilish va zarbalar — oddiydan o‘yin holatlarigacha."
          },
          {
            title: "O‘yin mashqlari",
            body: "Birga-bir, ikki-ga-ikki va texnikani harakatda qo‘llash kerak bo‘lgan vaziyatlar."
          },
          {
            title: "O‘yin",
            body: "Bola real o‘yin tezligida qaror qabul qilishni sinab ko‘radi va o‘zini jamoaning bir qismi sifatida his qiladi."
          }
        ],
        skills: [
          "to‘pni harakatda boshqarish",
          "sherikka aniq pas berish",
          "to‘g‘ri zarba bajarish",
          "to‘psiz ochilish va harakatlanish",
          "himoyada o‘ynash",
          "asosiy o‘yin vaziyatlarini tushunish"
        ],
        fit: [
          "faol o‘yinlar va to‘pni yoqtiradi",
          "ko‘proq harakat va dinamika istaydi",
          "jamoaviy sportga qiziqadi",
          "tengdoshlar bilan ishonchliroq muloqot qilishni xohlaydi",
          "mashg‘ulot natijasini aniq ko‘rishni yoqtiradi"
        ],
        beginner:
          "Oldindan dribling qilish yoki savatga aniq tashlashni bilish shart emas. Birinchi mashg‘ulotda sinab ko‘rish istagi, murabbiyni tinglash va mashqlarga qo‘shilish muhim.",
        ctaTitle: "Basketbolni uzoq tanlashdan ko‘ra bir marta his qilib ko‘rgan yaxshi",
        ctaLead:
          "Sinov mashg‘uloti bolaga o‘yin sur’ati, to‘p bilan ishlash va jamoa muhiti yoqadimi — shuni ko‘rsatadi."
      }
    }
  },
  {
    slug: "football",
    nameRu: "Футбол",
    nameUz: "Futbol",
    descriptionRu: "Техника, скорость и командное мышление.",
    descriptionUz: "Texnika, tezlik va jamoaviy fikrlash.",
    mark: "02",
    story: {
      ru: {
        heroLead:
          "Футбол — это движение, мяч и постоянный выбор. Ребёнок учится контролировать мяч, видеть пространство и действовать не отдельно, а как часть команды.",
        traits: ["Мяч", "Скорость", "Выносливость", "Команда", "Тактика"],
        why: [
          {
            title: "Мяч всегда даёт цель",
            body: "Обводка, пас, удар и гол превращают обычную физическую нагрузку в игру, к которой хочется возвращаться."
          },
          {
            title: "Много движения",
            body: "Ускорения, остановки, развороты и смена темпа делают тренировку динамичной и разнообразной."
          },
          {
            title: "Каждый может найти роль",
            body: "Кому-то ближе атака, кому-то защита, кому-то создание моментов — ребёнок постепенно понимает свои сильные стороны."
          },
          {
            title: "Нужно видеть поле",
            body: "Хороший футбол — это не только бег за мячом, но и понимание пространства, партнёров и следующего действия."
          }
        ],
        physical: [
          "скорость и ускорение",
          "выносливость",
          "координация ног",
          "баланс и ловкость",
          "точность движений"
        ],
        character: [
          "настойчивость",
          "самоконтроль",
          "дисциплина",
          "командная ответственность",
          "умение быстро перестраиваться"
        ],
        training: [
          {
            title: "Движение и разминка",
            body: "Беговые упражнения, координация, работа ног и подготовка к более интенсивной части занятия."
          },
          {
            title: "Работа с мячом",
            body: "Ведение, приём, передача, обводка и удар по воротам."
          },
          {
            title: "Игровые ситуации",
            body: "Небольшие упражнения и мини-игры, где нужно увидеть партнёра и выбрать решение."
          },
          {
            title: "Матч",
            body: "То, ради чего складываются все навыки: игра, эмоции, голы, защита и общая цель команды."
          }
        ],
        skills: [
          "контролировать мяч обеими ногами",
          "принимать и отдавать передачу",
          "менять направление с мячом",
          "бить по воротам",
          "открываться под пас",
          "понимать базовые принципы атаки и защиты"
        ],
        fit: [
          "любит мяч и подвижные игры",
          "хочет много бегать и двигаться",
          "эмоционально включается в соревнование",
          "интересуется командой и общей целью",
          "хочет развивать технику постепенно и заметно"
        ],
        beginner:
          "Неважно, играл ребёнок раньше во дворе или впервые приходит к мячу. Техника строится шаг за шагом, а тренировочная группа даёт безопасное пространство для ошибок и прогресса.",
        ctaTitle: "Понять футбол можно только когда мяч окажется у ног",
        ctaLead:
          "На пробном занятии ребёнок почувствует темп, упражнения, команду и поймёт, хочется ли ему вернуться на следующую тренировку."
      },
      uz: {
        heroLead:
          "Futbol — bu harakat, to‘p va doimiy tanlov. Bola to‘pni boshqarishni, maydonni ko‘rishni va alohida emas, jamoaning bir qismi sifatida harakat qilishni o‘rganadi.",
        traits: ["To‘p", "Tezlik", "Chidamlilik", "Jamoa", "Taktika"],
        why: [
          {
            title: "To‘p doimo maqsad beradi",
            body: "Aldab o‘tish, pas, zarba va gol oddiy jismoniy yuklamani qayta-qayta o‘ynagisi keladigan jarayonga aylantiradi."
          },
          {
            title: "Harakat juda ko‘p",
            body: "Tezlanish, to‘xtash, burilish va tempni o‘zgartirish mashg‘ulotni dinamik va turli qiladi."
          },
          {
            title: "Har kim o‘z rolini topadi",
            body: "Kimdir hujumni, kimdir himoyani, kimdir vaziyat yaratishni yoqtiradi — bola o‘z kuchli tomonlarini asta-sekin anglaydi."
          },
          {
            title: "Maydonni ko‘rish kerak",
            body: "Yaxshi futbol faqat to‘p ortidan yugurish emas, balki bo‘sh joy, sheriklar va keyingi harakatni ko‘ra bilishdir."
          }
        ],
        physical: [
          "tezlik va tezlanish",
          "chidamlilik",
          "oyoq koordinatsiyasi",
          "muvozanat va chaqqonlik",
          "harakat aniqligi"
        ],
        character: [
          "qat’iyat",
          "o‘zini boshqarish",
          "intizom",
          "jamoa oldidagi mas’uliyat",
          "tez moslashish"
        ],
        training: [
          {
            title: "Harakat va qizish",
            body: "Yugurish mashqlari, koordinatsiya, oyoq ishlashi va faol qismga tayyorgarlik."
          },
          {
            title: "To‘p bilan ishlash",
            body: "Dribling, qabul qilish, pas, aldab o‘tish va darvozaga zarba."
          },
          {
            title: "O‘yin vaziyatlari",
            body: "Sherikni ko‘rish va qaror tanlash kerak bo‘lgan kichik mashqlar va mini-o‘yinlar."
          },
          {
            title: "O‘yin",
            body: "Barcha ko‘nikmalar birlashadigan qism: harakat, gollar, himoya, hissiyot va jamoaning umumiy maqsadi."
          }
        ],
        skills: [
          "to‘pni ikki oyoqda boshqarish",
          "to‘pni qabul qilish va pas berish",
          "to‘p bilan yo‘nalishni o‘zgartirish",
          "darvozaga zarba berish",
          "pas uchun ochilish",
          "hujum va himoyaning asosiy tamoyillarini tushunish"
        ],
        fit: [
          "to‘p va harakatli o‘yinlarni yaxshi ko‘radi",
          "ko‘p yugurishni istaydi",
          "raqobatga hissiy qo‘shiladi",
          "jamoa va umumiy maqsadni yoqtiradi",
          "texnikadagi o‘sishni bosqichma-bosqich ko‘rishni istaydi"
        ],
        beginner:
          "Bola avval hovlida futbol o‘ynaganmi yoki to‘p bilan ilk bor tanishyaptimi — farqi yo‘q. Texnika bosqichma-bosqich quriladi, mashg‘ulot esa xato qilish va o‘sish uchun joy beradi.",
        ctaTitle: "Futbolni to‘p oyoqqa kelganda tushunish boshlanadi",
        ctaLead:
          "Sinov mashg‘ulotida bola o‘yin sur’atini, mashqlarni va jamoani his qiladi hamda yana qaytishni xohlash-xohlamasligini tushunadi."
      }
    }
  },
  {
    slug: "volleyball",
    nameRu: "Волейбол",
    nameUz: "Voleybol",
    descriptionRu: "Реакция, координация и работа в команде.",
    descriptionUz: "Reaksiya, koordinatsiya va jamoada ishlash.",
    mark: "03",
    story: {
      ru: {
        heroLead:
          "В волейболе мяч почти не задерживается у одного игрока. Нужно быстро занять позицию, почувствовать момент и продолжить комбинацию — поэтому здесь особенно ценятся реакция, координация и доверие к команде.",
        traits: ["Реакция", "Прыжок", "Координация", "Команда", "Точность"],
        why: [
          {
            title: "Каждое касание важно",
            body: "Один хороший приём запускает всю комбинацию. Ребёнок быстро понимает, что даже короткое действие влияет на команду."
          },
          {
            title: "Красивое чувство ритма",
            body: "Приём, передача, разбег, прыжок и удар соединяются в последовательность, которая постепенно становится естественной."
          },
          {
            title: "Команда действительно нужна",
            body: "Нельзя долго играть одному: партнёры постоянно дополняют друг друга и вместе доводят мяч до результата."
          },
          {
            title: "Меньше хаоса — больше точности",
            body: "Волейбол учит быть готовым заранее: занять место, держать внимание и выполнить техническое действие вовремя."
          }
        ],
        physical: [
          "реакция",
          "координация",
          "прыгучесть",
          "быстрота перемещений",
          "контроль положения тела"
        ],
        character: [
          "концентрация",
          "дисциплина",
          "доверие партнёрам",
          "ответственность за своё действие",
          "спокойствие после ошибки"
        ],
        training: [
          {
            title: "Подготовка тела",
            body: "Разминка, работа ног, реакция и перемещения по площадке."
          },
          {
            title: "Контроль мяча",
            body: "Приём снизу, передача сверху и упражнения, которые учат чувствовать траекторию мяча."
          },
          {
            title: "Связки и движение",
            body: "Переходы между позициями, подача, атака и взаимодействие с партнёрами."
          },
          {
            title: "Игровая практика",
            body: "Мини-игры и розыгрыши, где техника превращается в понятную командную систему."
          }
        ],
        skills: [
          "принимать мяч снизу",
          "передавать мяч сверху",
          "выполнять подачу",
          "правильно перемещаться по площадке",
          "готовиться к атакующему удару",
          "поддерживать командную комбинацию"
        ],
        fit: [
          "любит точность и понятную технику",
          "интересуется командной игрой",
          "хочет развивать реакцию",
          "любит прыжковые и координационные упражнения",
          "предпочитает игру без постоянной борьбы корпус в корпус"
        ],
        beginner:
          "Первое время мяч может лететь совсем не туда — это нормально. Волейбольное чувство мяча формируется через повторения, и уже небольшие улучшения дают сильное ощущение результата.",
        ctaTitle: "Первый хороший приём часто меняет впечатление о волейболе",
        ctaLead:
          "Пробное занятие даст ребёнку почувствовать мяч, ритм игры и то самое командное взаимодействие, ради которого волейбол затягивает."
      },
      uz: {
        heroLead:
          "Voleybolda to‘p deyarli hech qachon bitta o‘yinchida qolib ketmaydi. Joyni tez egallash, vaqtni his qilish va kombinatsiyani davom ettirish kerak — shu sababli reaksiya, koordinatsiya va jamoaga ishonch juda muhim.",
        traits: ["Reaksiya", "Sakrash", "Koordinatsiya", "Jamoa", "Aniqlik"],
        why: [
          {
            title: "Har bir tegish muhim",
            body: "Bitta yaxshi qabul butun kombinatsiyani boshlaydi. Bola hatto qisqa harakati ham jamoaga ta’sir qilishini tez tushunadi."
          },
          {
            title: "Harakat ritmi chiroyli",
            body: "Qabul, pas, yugurib kelish, sakrash va zarba asta-sekin tabiiy ketma-ketlikka aylanadi."
          },
          {
            title: "Jamoa haqiqatdan kerak",
            body: "Yakka holda uzoq o‘ynab bo‘lmaydi: sheriklar bir-birini to‘ldiradi va to‘pni birgalikda natijaga olib boradi."
          },
          {
            title: "Kamroq tartibsizlik, ko‘proq aniqlik",
            body: "Voleybol oldindan tayyor turishni o‘rgatadi: joyni egallash, diqqatni saqlash va texnik harakatni vaqtida bajarish."
          }
        ],
        physical: [
          "reaksiya",
          "koordinatsiya",
          "sakrovchanlik",
          "tez joy almashish",
          "tana holatini nazorat qilish"
        ],
        character: [
          "diqqat",
          "intizom",
          "sheriklarga ishonch",
          "o‘z harakatiga mas’uliyat",
          "xatodan keyin xotirjam davom etish"
        ],
        training: [
          {
            title: "Tanani tayyorlash",
            body: "Qizish, oyoq ishlashi, reaksiya va maydon bo‘ylab harakatlanish."
          },
          {
            title: "To‘p nazorati",
            body: "Pastdan qabul, yuqoridan uzatish va to‘p trayektoriyasini his qilishga yordam beradigan mashqlar."
          },
          {
            title: "Bog‘lanish va harakat",
            body: "Pozitsiyalar o‘rtasida o‘tish, servis, hujum va sheriklar bilan hamkorlik."
          },
          {
            title: "O‘yin amaliyoti",
            body: "Texnika tushunarli jamoaviy tizimga aylanadigan mini-o‘yinlar va to‘p almashishlar."
          }
        ],
        skills: [
          "to‘pni pastdan qabul qilish",
          "to‘pni yuqoridan uzatish",
          "servis bajarish",
          "maydonda to‘g‘ri harakatlanish",
          "hujum zarbasiga tayyorlanish",
          "jamoaviy kombinatsiyani davom ettirish"
        ],
        fit: [
          "aniqlik va tushunarli texnikani yoqtiradi",
          "jamoaviy o‘yinga qiziqadi",
          "reaksiyasini rivojlantirmoqchi",
          "sakrash va koordinatsion mashqlarni yoqtiradi",
          "doimiy tana kurashisiz o‘yinni afzal ko‘radi"
        ],
        beginner:
          "Boshida to‘p umuman kerakli tomonga uchmasligi mumkin — bu tabiiy. To‘pni his qilish takrorlash orqali shakllanadi va kichik o‘sishning o‘zi ham kuchli natija hissini beradi.",
        ctaTitle: "Birinchi yaxshi qabul voleybol haqidagi fikrni o‘zgartirishi mumkin",
        ctaLead:
          "Sinov mashg‘ulotida bola to‘pni, o‘yin ritmini va voleybolni qiziqarli qiladigan jamoaviy hamkorlikni his qiladi."
      }
    }
  },
  {
    slug: "athletics",
    nameRu: "Лёгкая атлетика",
    nameUz: "Yengil atletika",
    descriptionRu: "Скорость, выносливость и сильная двигательная база.",
    descriptionUz: "Tezlik, chidamlilik va kuchli harakat bazasi.",
    mark: "04",
    story: {
      ru: {
        heroLead:
          "Лёгкая атлетика строится на самых естественных движениях — беге, прыжках и работе с собственным телом. Ребёнок соревнуется прежде всего со своим прошлым результатом и постепенно становится быстрее, выносливее и техничнее.",
        traits: ["Скорость", "Выносливость", "Сила", "Техника", "Личный прогресс"],
        why: [
          {
            title: "Понятный личный результат",
            body: "Время, дистанция, качество движения и техника позволяют ребёнку видеть собственный прогресс без сравнений с другими."
          },
          {
            title: "Много разных задач",
            body: "Спринт, координационные упражнения, прыжки, эстафеты и работа на выносливость делают занятия разнообразными."
          },
          {
            title: "Сильная двигательная база",
            body: "Правильный бег, работа стоп, корпуса и рук формируют навыки движения, которые полезны и в других видах спорта."
          },
          {
            title: "Можно расти в своём темпе",
            body: "Кому-то нравится скорость, кому-то длинная работа, кому-то прыжковые задачи — направление постепенно раскрывается через практику."
          }
        ],
        physical: [
          "скорость",
          "выносливость",
          "общая сила",
          "координация движений",
          "техника бега и прыжка"
        ],
        character: [
          "самодисциплина",
          "терпение",
          "настойчивость",
          "умение работать на личную цель",
          "спокойное отношение к постепенному прогрессу"
        ],
        training: [
          {
            title: "Динамическая разминка",
            body: "Подготовка суставов и мышц, координационные упражнения и лёгкий бег."
          },
          {
            title: "Техника движения",
            body: "Положение корпуса, работа рук и ног, беговые упражнения и контроль шага."
          },
          {
            title: "Основной блок",
            body: "Скорость, прыжки, эстафеты или работа на выносливость — в зависимости от задачи тренировки."
          },
          {
            title: "Контроль прогресса",
            body: "Ребёнок постепенно замечает, что двигается увереннее, выполняет упражнения точнее и справляется с большей нагрузкой."
          }
        ],
        skills: [
          "технически лучше бегать",
          "правильно ускоряться",
          "контролировать темп",
          "эффективнее выполнять прыжковые движения",
          "координировать руки и ноги",
          "распределять усилия на дистанции"
        ],
        fit: [
          "любит бегать и много двигаться",
          "предпочитает личный прогресс командной игре",
          "хочет развить общую физическую базу",
          "интересуется скоростью или выносливостью",
          "любит измеримый результат"
        ],
        beginner:
          "Для старта не нужны специальные спортивные навыки. Тренер смотрит на исходный уровень и даёт упражнения, с которых ребёнок может безопасно начать и постепенно усложнять нагрузку.",
        ctaTitle: "Иногда лучший спорт начинается с простого: побежать и почувствовать, что можешь быстрее",
        ctaLead:
          "На пробном занятии ребёнок познакомится с разными типами движений и поймёт, нравится ли ему работать на собственный результат."
      },
      uz: {
        heroLead:
          "Yengil atletika eng tabiiy harakatlar — yugurish, sakrash va o‘z tanasi bilan ishlashga quriladi. Bola avvalo o‘zining kechagi natijasi bilan bellashadi va asta-sekin tezroq, chidamliroq hamda texnikroq bo‘lib boradi.",
        traits: ["Tezlik", "Chidamlilik", "Kuch", "Texnika", "Shaxsiy o‘sish"],
        why: [
          {
            title: "Shaxsiy natija aniq ko‘rinadi",
            body: "Vaqt, masofa va harakat sifati bola o‘z o‘sishini boshqalar bilan solishtirmasdan ko‘rishiga yordam beradi."
          },
          {
            title: "Vazifalar turli",
            body: "Sprint, koordinatsion mashqlar, sakrash, estafeta va chidamlilik ishlari mashg‘ulotni xilma-xil qiladi."
          },
          {
            title: "Kuchli harakat bazasi",
            body: "To‘g‘ri yugurish, oyoq panjasi, tana va qo‘l ishlashi boshqa sport turlarida ham kerak bo‘ladigan harakat ko‘nikmalarini beradi."
          },
          {
            title: "O‘z tempida o‘sish mumkin",
            body: "Kimdir tezlikni, kimdir uzoq ishlashni, kimdir sakrashni yoqtiradi — yo‘nalish amaliyot orqali asta-sekin ochiladi."
          }
        ],
        physical: [
          "tezlik",
          "chidamlilik",
          "umumiy kuch",
          "harakat koordinatsiyasi",
          "yugurish va sakrash texnikasi"
        ],
        character: [
          "o‘zini intizomga o‘rgatish",
          "sabr",
          "qat’iyat",
          "shaxsiy maqsad uchun ishlash",
          "asta-sekin o‘sishga xotirjam yondashish"
        ],
        training: [
          {
            title: "Dinamik qizish",
            body: "Bo‘g‘im va mushaklarni tayyorlash, koordinatsion mashqlar va yengil yugurish."
          },
          {
            title: "Harakat texnikasi",
            body: "Tana holati, qo‘l va oyoq ishlashi, yugurish mashqlari va qadam nazorati."
          },
          {
            title: "Asosiy blok",
            body: "Mashg‘ulot maqsadiga qarab tezlik, sakrash, estafeta yoki chidamlilik ustida ish."
          },
          {
            title: "O‘sishni sezish",
            body: "Bola asta-sekin ishonchliroq harakat qilayotganini, mashqlarni aniqroq bajarayotganini va ko‘proq yuklamani uddalayotganini ko‘radi."
          }
        ],
        skills: [
          "texnik jihatdan yaxshiroq yugurish",
          "to‘g‘ri tezlanish",
          "tempni boshqarish",
          "sakrash harakatlarini samaraliroq bajarish",
          "qo‘l va oyoqlarni muvofiqlashtirish",
          "masofada kuchni taqsimlash"
        ],
        fit: [
          "yugurish va ko‘p harakatni yoqtiradi",
          "jamoaviy o‘yindan ko‘ra shaxsiy o‘sishni afzal ko‘radi",
          "umumiy jismoniy bazani rivojlantirmoqchi",
          "tezlik yoki chidamlilikka qiziqadi",
          "o‘lchanadigan natijani yoqtiradi"
        ],
        beginner:
          "Boshlash uchun maxsus sport ko‘nikmalari kerak emas. Murabbiy bolaning boshlang‘ich darajasini ko‘rib, xavfsiz boshlash va yuklamani asta-sekin oshirish mumkin bo‘lgan mashqlarni tanlaydi.",
        ctaTitle: "Ba’zan eng mos sport oddiy yugurishdan boshlanadi",
        ctaLead:
          "Sinov mashg‘ulotida bola turli harakatlarni sinab ko‘radi va o‘z natijasi ustida ishlash unga yoqadimi — shuni tushunadi."
      }
    }
  },
  {
    slug: "rhythmic-gymnastics",
    nameRu: "Художественная гимнастика",
    nameUz: "Badiiy gimnastika",
    descriptionRu: "Гибкость, координация, дисциплина и грация.",
    descriptionUz: "Egiluvchanlik, koordinatsiya, intizom va nafislik.",
    mark: "05",
    story: {
      ru: {
        heroLead:
          "Художественная гимнастика соединяет движение, музыку, гибкость и выразительность. Здесь ребёнок учится не просто выполнять элемент, а делать его точно, красиво и уверенно.",
        traits: ["Гибкость", "Координация", "Музыка", "Точность", "Выразительность"],
        why: [
          {
            title: "Красивый результат мотивирует",
            body: "Даже простая связка начинает выглядеть по-другому, когда движения становятся точнее, мягче и увереннее."
          },
          {
            title: "Тело учится слушаться",
            body: "Положение рук, стоп, корпуса и головы постепенно соединяются в единое контролируемое движение."
          },
          {
            title: "Музыка делает тренировку живой",
            body: "Ритм помогает почувствовать темп и характер движения, а упражнения превращаются в небольшую композицию."
          },
          {
            title: "Есть место характеру",
            body: "Техника требует повторений и внимания к деталям, поэтому ребёнок учится спокойно работать над тем, что не получается сразу."
          }
        ],
        physical: [
          "гибкость",
          "координация",
          "баланс",
          "подвижность",
          "контроль корпуса и осанки"
        ],
        character: [
          "дисциплина",
          "внимание к деталям",
          "терпение",
          "уверенность при выступлении",
          "выразительность"
        ],
        training: [
          {
            title: "Разминка и мобильность",
            body: "Мягкая подготовка тела, суставов и мышц к работе над амплитудой и техникой."
          },
          {
            title: "Базовые элементы",
            body: "Положения тела, равновесие, повороты, прыжки и связки подходящего уровня."
          },
          {
            title: "Координация и предмет",
            body: "По мере подготовки добавляется работа с предметами и соединение движений в более сложные комбинации."
          },
          {
            title: "Композиция и музыка",
            body: "Ребёнок учится выполнять связку целиком, держать ритм и передавать характер движения."
          }
        ],
        skills: [
          "лучше контролировать положение тела",
          "держать равновесие",
          "выполнять базовые повороты и прыжки",
          "двигаться в музыкальном ритме",
          "соединять элементы в связку",
          "работать над точностью и выразительностью"
        ],
        fit: [
          "любит музыку и красивые движения",
          "интересуется гибкостью и координацией",
          "готова внимательно повторять элементы",
          "нравится индивидуальный прогресс",
          "интересно учиться выступать увереннее"
        ],
        beginner:
          "Не нужно приходить уже гибкой или уметь садиться на шпагат. Исходные возможности у детей разные, а задача тренировки — постепенно развивать технику и амплитуду без гонки за чужим результатом.",
        ctaTitle: "Интерес к гимнастике появляется, когда ребёнок сам чувствует движение",
        ctaLead:
          "Пробное занятие поможет понять, нравится ли ребёнку сочетание музыки, техники, гибкости и работы над красивой связкой."
      },
      uz: {
        heroLead:
          "Badiiy gimnastika harakat, musiqa, egiluvchanlik va ifodalilikni birlashtiradi. Bu yerda bola faqat elementni bajarishni emas, uni aniq, chiroyli va ishonchli bajarishni o‘rganadi.",
        traits: ["Egiluvchanlik", "Koordinatsiya", "Musiqa", "Aniqlik", "Ifodalilik"],
        why: [
          {
            title: "Chiroyli natija ilhomlantiradi",
            body: "Oddiy bog‘lama ham harakatlar aniqroq, yumshoqroq va ishonchliroq bo‘lganda butunlay boshqacha ko‘rina boshlaydi."
          },
          {
            title: "Tana boshqarilishni o‘rganadi",
            body: "Qo‘l, oyoq panjasi, tana va bosh holati asta-sekin bitta nazorat qilinadigan harakatga birlashadi."
          },
          {
            title: "Musiqa mashg‘ulotni jonlantiradi",
            body: "Ritm harakat tempini his qilishga yordam beradi va mashqlar kichik kompozitsiyaga aylanadi."
          },
          {
            title: "Xarakter ham ishlaydi",
            body: "Texnika takror va detallarga e’tibor talab qiladi, shuning uchun bola darrov chiqmagan narsaga xotirjam qaytishni o‘rganadi."
          }
        ],
        physical: [
          "egiluvchanlik",
          "koordinatsiya",
          "muvozanat",
          "harakatchanlik",
          "tana va qomat nazorati"
        ],
        character: [
          "intizom",
          "detallarga e’tibor",
          "sabr",
          "chiqish paytidagi ishonch",
          "ifodalilik"
        ],
        training: [
          {
            title: "Qizish va harakatchanlik",
            body: "Tana, bo‘g‘im va mushaklarni amplituda hamda texnika ustida ishlashga yumshoq tayyorlash."
          },
          {
            title: "Asosiy elementlar",
            body: "Tana holatlari, muvozanat, burilish, sakrash va darajaga mos bog‘lamalar."
          },
          {
            title: "Koordinatsiya va predmet",
            body: "Tayyorgarlik oshgani sari predmet bilan ishlash va harakatlarni murakkabroq kombinatsiyalarga ulash qo‘shiladi."
          },
          {
            title: "Kompozitsiya va musiqa",
            body: "Bola bog‘lamani to‘liq bajarish, ritmni ushlash va harakat xarakterini ko‘rsatishni o‘rganadi."
          }
        ],
        skills: [
          "tana holatini yaxshiroq boshqarish",
          "muvozanatni saqlash",
          "asosiy burilish va sakrashlarni bajarish",
          "musiqiy ritmda harakat qilish",
          "elementlarni bog‘lamaga birlashtirish",
          "aniqlik va ifodalilik ustida ishlash"
        ],
        fit: [
          "musiqa va chiroyli harakatlarni yoqtiradi",
          "egiluvchanlik va koordinatsiyaga qiziqadi",
          "elementlarni diqqat bilan takrorlashga tayyor",
          "shaxsiy o‘sishni yoqtiradi",
          "ishonchliroq chiqish qilishni o‘rganishga qiziqadi"
        ],
        beginner:
          "Oldindan juda egiluvchan bo‘lish yoki shpagatga o‘tirishni bilish shart emas. Bolalarning boshlang‘ich imkoniyatlari turlicha, mashg‘ulotning vazifasi esa boshqalarning natijasiga quvmasdan texnika va amplitudani bosqichma-bosqich rivojlantirishdir.",
        ctaTitle: "Gimnastikaga qiziqish bola harakatni o‘zi his qilganda boshlanadi",
        ctaLead:
          "Sinov mashg‘uloti bolaga musiqa, texnika, egiluvchanlik va chiroyli bog‘lama ustida ishlash uyg‘unligi yoqadimi — shuni tushunishga yordam beradi."
      }
    }
  }
];

export function getSportCatalogEntry(slug: string) {
  return SPORT_CATALOG.find((sport) => sport.slug === slug) ?? null;
}
