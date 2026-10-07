import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";
import { SPORT_CATALOG } from "@/lib/sport-catalog";
import { tryGetPublishedHomeCms } from "@/server/public-data/cms";
import { tryGetPublishedContentPage } from "@/server/public-data/content-page";
import { tryGetPublicHomeData } from "@/server/public-data/home";

export const dynamic = "force-dynamic";

function imageStyle(url?: string | null) {
  return url ? { backgroundImage: `url("${url}")` } : undefined;
}

export default async function PublicHome({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  const [cms, data, aboutPage] = await Promise.all([
    tryGetPublishedHomeCms(),
    tryGetPublicHomeData(),
    tryGetPublishedContentPage("about")
  ]);

  const defaults =
    locale === "ru"
      ? {
          eyebrow: "SHARK TEAM · ТАШКЕНТ",
          title: "Спорт, в который хочется возвращаться",
          lead: "Спортивные секции для детей в Ташкенте. Баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика.",
          sportsTitle: "Больше, чем одна команда",
          sportsLead: "Спортивные направления SHARK TEAM. Одна философия: движение, характер, дисциплина и уверенность.",
          whyTitle: "Почему выбирают SHARK TEAM",
          coachesTitle: "Наши тренеры",
          branchesTitle: "Наши филиалы",
          trialTitle: "Как проходит пробное занятие",
          faqTitle: "Часто задаваемые вопросы",
          ctaTitle: "Готовы к новым достижениям?",
          ctaLead: "Выберите вид спорта и сделайте первый шаг вместе с SHARK TEAM.",
          chooseSport: "Выбрать вид спорта",
          trial: "Записаться на пробное",
          allSports: "Все виды спорта",
          allCoaches: "Все тренеры",
          allBranches: "Все филиалы"
        }
      : {
          eyebrow: "SHARK TEAM · TOSHKENT",
          title: "Qayta-qayta kelgingiz keladigan sport",
          lead: "Toshkentdagi bolalar sport seksiyalari. Basketbol, futbol, voleybol, yengil atletika va badiiy gimnastika.",
          sportsTitle: "Bitta jamoadan ko‘proq",
          sportsLead: "SHARK TEAM sport yo‘nalishlari. Bitta falsafa: harakat, xarakter, intizom va ishonch.",
          whyTitle: "Nega SHARK TEAM tanlanadi",
          coachesTitle: "Murabbiylarimiz",
          branchesTitle: "Filiallarimiz",
          trialTitle: "Sinov mashg‘uloti qanday o‘tadi",
          faqTitle: "Ko‘p so‘raladigan savollar",
          ctaTitle: "Yangi yutuqlarga tayyormisiz?",
          ctaLead: "Sport turini tanlang va SHARK TEAM bilan birinchi qadamni qo‘ying.",
          chooseSport: "Sport turini tanlash",
          trial: "Sinovga yozilish",
          allSports: "Barcha sport turlari",
          allCoaches: "Barcha murabbiylar",
          allBranches: "Barcha filiallar"
        };

  const content = cms.content;
  const copy = {
    ...defaults,
    eyebrow:
      (locale === "ru"
        ? content?.heroEyebrowRu
        : content?.heroEyebrowUz) ?? defaults.eyebrow,
    title:
      (locale === "ru"
        ? content?.heroTitleRu
        : content?.heroTitleUz) ?? defaults.title,
    lead:
      (locale === "ru"
        ? content?.heroLeadRu
        : content?.heroLeadUz) ?? defaults.lead
  };

  const pageHero =
    cms.media.find((item) => item.isPrimary && item.contentType?.startsWith("image/")) ??
    cms.media.find((item) => item.contentType?.startsWith("image/")) ??
    null;

  const trainingVideo =
    cms.media.find((item) => item.contentType?.startsWith("video/")) ?? null;


  const aboutHero =
    aboutPage?.media.find(
      (item) => item.isPrimary && item.contentType?.startsWith("image/")
    ) ??
    aboutPage?.media.find((item) => item.contentType?.startsWith("image/")) ??
    null;

  const aboutText =
    (locale === "ru"
      ? aboutPage?.content.bodyRu
      : aboutPage?.content.bodyUz)?.split(/\n\s*\n/)[0] ??
    (locale === "ru"
      ? "SHARK TEAM — спортивная среда, в которой ребёнок развивается через регулярные тренировки, команду и понятную систему прогресса."
      : "SHARK TEAM — bola muntazam mashg‘ulot, jamoa va tushunarli rivojlanish tizimi orqali o‘sadigan sport muhiti.");

  const activeGroupCount =
    data?.sports.reduce((total, sport) => total + sport.groups.length, 0) ?? 0;

  const homeSports = data
    ? data.sports.map((sport, index) => {
        const fallback = SPORT_CATALOG.find((item) => item.slug === sport.slug);
        return {
          id: sport.id,
          slug: sport.slug,
          nameRu: sport.nameRu,
          nameUz: sport.nameUz,
          descriptionRu:
            sport.shortDescriptionRu ?? fallback?.descriptionRu ?? "",
          descriptionUz:
            sport.shortDescriptionUz ?? fallback?.descriptionUz ?? "",
          mark: fallback?.mark ?? String(index + 1).padStart(2, "0"),
          groups: sport.groups
        };
      })
    : SPORT_CATALOG.map((sport) => ({
        id: sport.slug,
        ...sport,
        groups: [] as { id: string }[]
      }));

  const aboutStats =
    locale === "ru"
      ? [
          [String(data?.sports.length ?? 0), "видов спорта"],
          [String(data?.branches.length ?? 0), "филиалов"],
          [String(data?.coaches.length ?? 0), "тренеров"],
          [String(activeGroupCount), "активных групп"]
        ]
      : [
          [String(data?.sports.length ?? 0), "sport turi"],
          [String(data?.branches.length ?? 0), "filial"],
          [String(data?.coaches.length ?? 0), "murabbiy"],
          [String(activeGroupCount), "faol guruh"]
        ];

  const benefits =
    locale === "ru"
      ? [
          ["01", "Профессиональные тренеры", "Специалисты, которые умеют работать с детьми и давать понятную обратную связь."],
          ["02", "Комплексное развитие", "Физическая форма, координация, дисциплина, уверенность и командные навыки."],
          ["03", "Безопасная среда", "Понятные группы по возрасту, контролируемая нагрузка и прозрачная коммуникация."],
          ["04", "Дружелюбная атмосфера", "Ребёнок становится частью команды и хочет возвращаться на тренировку."]
        ]
      : [
          ["01", "Professional murabbiylar", "Bolalar bilan ishlay oladigan va tushunarli fikr-mulohaza beradigan mutaxassislar."],
          ["02", "Kompleks rivojlanish", "Jismoniy tayyorgarlik, koordinatsiya, intizom, ishonch va jamoaviy ko‘nikmalar."],
          ["03", "Xavfsiz muhit", "Yosh bo‘yicha tushunarli guruhlar, nazorat qilinadigan yuklama va ochiq muloqot."],
          ["04", "Do‘stona atmosfera", "Bola jamoaning bir qismiga aylanadi va mashg‘ulotga qaytishni xohlaydi."]
        ];

  const trialSteps =
    locale === "ru"
      ? [
          ["1", "Вы выбираете спорт", "Смотрите направления и доступные филиалы."],
          ["2", "Мы подбираем группу", "Система учитывает возраст и свободные занятия."],
          ["3", "Ребёнок приходит на пробное", "Знакомится с тренером, командой и форматом."],
          ["4", "Вы принимаете решение", "После занятия можно продолжить без обязательств."]
        ]
      : [
          ["1", "Sport turini tanlaysiz", "Yo‘nalishlar va mavjud filiallarni ko‘rasiz."],
          ["2", "Mos guruhni topamiz", "Tizim yosh va bo‘sh mashg‘ulotlarni hisobga oladi."],
          ["3", "Bola sinovga keladi", "Murabbiy, jamoa va format bilan tanishadi."],
          ["4", "Qaror qabul qilasiz", "Mashg‘ulotdan so‘ng davom ettirish majburiy emas."]
        ];

  return (
    <main className="page-main shark-home">
      <section className="shark-hero">
        <div className="shark-hero-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>

          <div className="hero-actions">
            <Link className="button primary" href={`/${locale}/sports`}>
              {copy.chooseSport} <span aria-hidden="true">→</span>
            </Link>
            <Link className="button secondary" href={`/${locale}/trial`}>
              {copy.trial}
            </Link>
          </div>

          <div className="shark-hero-facts" aria-label="SHARK TEAM facts">
            <div><strong>{data?.sports.length ?? SPORT_CATALOG.length}</strong><span>{locale === "ru" ? "видов спорта" : "sport turi"}</span></div>
            <div><strong>RU / UZ</strong><span>{locale === "ru" ? "два языка" : "ikki til"}</span></div>
            <div><strong>Ташкент</strong><span>{locale === "ru" ? "город запуска" : "start shahri"}</span></div>
          </div>
        </div>

        <div className={pageHero ? "shark-hero-media has-photo" : "shark-hero-media"} style={imageStyle(pageHero?.url)}>
          <div className="shark-hero-media-overlay" />
          <div className="shark-hero-watermark">SHARK</div>
          <div className="shark-hero-sports">
            {homeSports.map((sport) => (
              <span key={sport.slug}>{locale === "ru" ? sport.nameRu : sport.nameUz}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section shark-about-preview">
        <div className="shark-about-preview-copy">
          <p className="eyebrow">
            {locale === "ru" ? "О SHARK TEAM" : "SHARK TEAM HAQIDA"}
          </p>
          <h2>
            {locale === "ru"
              ? aboutPage?.content.heroTitleRu ?? "Спорт формирует больше, чем физическую форму"
              : aboutPage?.content.heroTitleUz ?? "Sport jismoniy tayyorgarlikdan ko‘proq narsani shakllantiradi"}
          </h2>
          <p>{aboutText}</p>
          <Link className="shark-text-link" href={`/${locale}/about`}>
            {locale === "ru" ? "Подробнее о SHARK TEAM →" : "SHARK TEAM haqida batafsil →"}
          </Link>
        </div>

        <div
          className={aboutHero ? "shark-about-preview-visual has-photo" : "shark-about-preview-visual"}
          style={imageStyle(aboutHero?.url)}
          role={aboutHero ? "img" : undefined}
          aria-label={
            aboutHero
              ? (locale === "ru" ? aboutHero.altRu : aboutHero.altUz) ??
                "SHARK TEAM"
              : undefined
          }
        >
          <div className="shark-about-stats">
            {aboutStats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section" id="sports">
        <div className="section-heading shark-section-heading">
          <div>
            <p className="eyebrow">{locale === "ru" ? "НАШИ ВИДЫ СПОРТА" : "SPORT YO‘NALISHLARIMIZ"}</p>
            <h2>{copy.sportsTitle}</h2>
          </div>
          <p>{copy.sportsLead}</p>
        </div>

        <div className="shark-sports-grid">
          {homeSports.map((sport) => {
            const photo = data?.media.find(
              (item) =>
                item.targetType === "SPORT" &&
                item.targetId === sport.id &&
                item.contentType?.startsWith("image/")
            );
            const isLive = Boolean(sport.groups.length);

            return (
              <Link
                className="shark-sport-card"
                href={`/${locale}/sports/${sport.slug}`}
                key={sport.id}
              >
                <div
                  className="shark-sport-photo"
                  style={imageStyle(photo?.url)}
                  role={photo ? "img" : undefined}
                  aria-label={
                    photo
                      ? (locale === "ru" ? photo.altRu : photo.altUz) ??
                        (locale === "ru" ? sport.nameRu : sport.nameUz)
                      : undefined
                  }
                >
                  <span className="shark-sport-index">{sport.mark}</span>
                  <span className={isLive ? "shark-status live" : "shark-status"}>
                    {isLive
                      ? locale === "ru" ? "идёт набор" : "qabul ochiq"
                      : locale === "ru" ? "направление" : "yo‘nalish"}
                  </span>
                </div>
                <div className="shark-sport-body">
                  <h3>{locale === "ru" ? sport.nameRu : sport.nameUz}</h3>
                  {(locale === "ru" ? sport.descriptionRu : sport.descriptionUz) ? (
                    <p>
                      {locale === "ru" ? sport.descriptionRu : sport.descriptionUz}
                    </p>
                  ) : null}
                  <span className="shark-arrow" aria-hidden="true">→</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="section-action">
          <Link className="shark-text-link" href={`/${locale}/sports`}>
            {copy.allSports} →
          </Link>
        </div>
      </section>

      <section className="content-section shark-why-section">
        <div className="section-heading">
          <p className="eyebrow">SHARK TEAM</p>
          <h2>{copy.whyTitle}</h2>
        </div>
        <div className="shark-benefit-grid">
          {benefits.map(([index, title, description]) => (
            <article className="shark-benefit-card" key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>

        <div className="shark-training-banner">
          {trainingVideo ? (
            <video controls preload="metadata" src={trainingVideo.url} />
          ) : (
            <div className="shark-training-placeholder">
              <span className="training-soon-badge">
                {locale === "ru" ? "Видео скоро" : "Video tez orada"}
              </span>
              <div>
                <strong>{locale === "ru" ? "Как проходят тренировки SHARK TEAM" : "SHARK TEAM mashg‘ulotlari qanday o‘tadi"}</strong>
                <p>{locale === "ru" ? "Добавим реальные видео с тренировок, как только подготовим материалы." : "Materiallar tayyor bo‘lishi bilan haqiqiy mashg‘ulot videolarini qo‘shamiz."}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading shark-section-heading">
          <div>
            <p className="eyebrow">{locale === "ru" ? "КОМАНДА" : "JAMOA"}</p>
            <h2>{copy.coachesTitle}</h2>
          </div>
          <Link className="shark-text-link" href={`/${locale}/coaches`}>{copy.allCoaches} →</Link>
        </div>

        <div className="shark-coach-grid">
          {(data?.coaches ?? []).slice(0, 4).map((coach) => {
            const photo = data?.media.find(
              (item) =>
                item.targetType === "COACH" &&
                item.targetId === coach.id &&
                item.contentType?.startsWith("image/")
            );
            const sports = coach.sportLinks
              .map((link) => locale === "ru" ? link.sport.nameRu : link.sport.nameUz)
              .join(" · ");

            return (
              <Link
                className="shark-coach-card shark-coach-card-link"
                href={`/${locale}/coaches/${coach.id}`}
                key={coach.id}
                aria-label={
                  locale === "ru"
                    ? `Подробнее о тренере ${[coach.firstName, coach.lastName].filter(Boolean).join(" ")}`
                    : `${[coach.firstName, coach.lastName].filter(Boolean).join(" ")} murabbiyi haqida batafsil`
                }
              >
                <div
                  className="shark-coach-photo"
                  style={imageStyle(photo?.url)}
                  role={photo ? "img" : undefined}
                  aria-label={
                    photo
                      ? (locale === "ru" ? photo.altRu : photo.altUz) ??
                        coach.firstName
                      : undefined
                  }
                >
                  {!photo ? <span>{coach.firstName.slice(0, 1)}</span> : null}
                </div>
                <div>
                  <h3>{[coach.firstName, coach.lastName].filter(Boolean).join(" ")}</h3>
                  <p>{sports || (locale === "ru" ? "Тренер SHARK TEAM" : "SHARK TEAM murabbiyi")}</p>
                  {coach.experienceYears ? (
                    <span>{locale === "ru" ? `Опыт ${coach.experienceYears}+ лет` : `Tajriba ${coach.experienceYears}+ yil`}</span>
                  ) : null}
                </div>
              </Link>
            );
          })}

          {!data?.coaches.length ? (
            <article className="shark-coach-card shark-empty-card">
              <div>
                <h3>{locale === "ru" ? "Команда тренеров" : "Murabbiylar jamoasi"}</h3>
                <p>{locale === "ru" ? "Информация о тренерах скоро появится." : "Murabbiylar haqida ma’lumot tez orada paydo bo‘ladi."}</p>
              </div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading shark-section-heading">
          <div>
            <p className="eyebrow">{locale === "ru" ? "ЛОКАЦИИ" : "MANZILLAR"}</p>
            <h2>{copy.branchesTitle}</h2>
          </div>
          <Link className="shark-text-link" href={`/${locale}/branches`}>{copy.allBranches} →</Link>
        </div>

        <div className="shark-branch-grid">
          {(data?.branches ?? []).slice(0, 3).map((branch) => {
            const photo = data?.media.find(
              (item) =>
                item.targetType === "BRANCH" &&
                item.targetId === branch.id &&
                item.contentType?.startsWith("image/")
            );
            const sports = Array.from(
              new Set(branch.groups.map((group) => locale === "ru" ? group.sport.nameRu : group.sport.nameUz))
            );

            return (
              <Link className="shark-branch-card" href={`/${locale}/branches/${branch.slug}`} key={branch.id}>
                <div
                  className="shark-branch-photo"
                  style={imageStyle(photo?.url)}
                  role={photo ? "img" : undefined}
                  aria-label={
                    photo
                      ? (locale === "ru" ? photo.altRu : photo.altUz) ??
                        (locale === "ru" ? branch.publicNameRu : branch.publicNameUz)
                      : undefined
                  }
                />
                <div>
                  <span>{locale === "ru" ? branch.districtRu : branch.districtUz}</span>
                  <h3>{locale === "ru" ? branch.publicNameRu : branch.publicNameUz}</h3>
                  <p>{sports.join(" · ")}</p>
                  <strong>{locale === "ru" ? "Открыть филиал →" : "Filialni ochish →"}</strong>
                </div>
              </Link>
            );
          })}

          {!data?.branches.length ? (
            <div className="shark-coming-soon">
              <h3>{locale === "ru" ? "Новые филиалы скоро появятся" : "Yangi filiallar tez orada paydo bo‘ladi"}</h3>
              <p>{locale === "ru" ? "Новые активные филиалы будут появляться здесь." : "Yangi faol filiallar shu yerda paydo bo‘ladi."}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">{locale === "ru" ? "ПЕРВЫЙ ШАГ" : "BIRINCHI QADAM"}</p>
          <h2>{copy.trialTitle}</h2>
        </div>
        <div className="shark-steps-grid">
          {trialSteps.map(([index, title, description]) => (
            <article key={index}>
              <span>{index}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="section-action">
          <Link className="button primary" href={`/${locale}/trial`}>{copy.trial} →</Link>
        </div>
      </section>

      {cms.faq.length > 0 ? (
        <section className="content-section shark-faq-section">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2>{copy.faqTitle}</h2>
          </div>
          <div className="faq-list shark-faq-list">
            {cms.faq.slice(0, 8).map((item) => (
              <details key={item.id} className="faq-item">
                <summary>{locale === "ru" ? item.questionRu : item.questionUz}</summary>
                <p>{locale === "ru" ? item.answerRu : item.answerUz}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="shark-final-cta">
        <div>
          <p className="eyebrow">SHARK TEAM</p>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaLead}</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href={`/${locale}/trial`}>{copy.trial} →</Link>
          <Link className="button secondary" href={`/${locale}/sports`}>{copy.chooseSport}</Link>
        </div>
      </section>
    </main>
  );
}
