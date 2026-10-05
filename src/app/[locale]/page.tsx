import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";
import { SPORT_CATALOG } from "@/lib/sport-catalog";
import { tryGetPublishedHomeCms } from "@/server/public-data/cms";
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

  const [cms, data] = await Promise.all([
    tryGetPublishedHomeCms(),
    tryGetPublicHomeData()
  ]);

  const defaults =
    locale === "ru"
      ? {
          eyebrow: "SHARK TEAM · ТАШКЕНТ",
          title: "Спорт, в который хочется возвращаться",
          lead: "Спортивные секции для детей в Ташкенте. Баскетбол, футбол, волейбол, лёгкая атлетика и художественная гимнастика.",
          sportsTitle: "Больше, чем одна команда",
          sportsLead: "Пять направлений. Одна философия: движение, характер, дисциплина и уверенность.",
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
          sportsLead: "Besh yo‘nalish. Bitta falsafa: harakat, xarakter, intizom va ishonch.",
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
            <div><strong>5</strong><span>{locale === "ru" ? "видов спорта" : "sport turi"}</span></div>
            <div><strong>RU / UZ</strong><span>{locale === "ru" ? "два языка" : "ikki til"}</span></div>
            <div><strong>Ташкент</strong><span>{locale === "ru" ? "город запуска" : "start shahri"}</span></div>
          </div>
        </div>

        <div className={pageHero ? "shark-hero-media has-photo" : "shark-hero-media"} style={imageStyle(pageHero?.url)}>
          <div className="shark-hero-media-overlay" />
          <div className="shark-hero-watermark">SHARK</div>
          <div className="shark-hero-sports">
            {SPORT_CATALOG.map((sport) => (
              <span key={sport.slug}>{locale === "ru" ? sport.nameRu : sport.nameUz}</span>
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
          {SPORT_CATALOG.map((entry) => {
            const sport = data?.sports.find((item) => item.slug === entry.slug);
            const photo = sport
              ? data?.media.find(
                  (item) =>
                    item.targetType === "SPORT" &&
                    item.targetId === sport.id &&
                    item.contentType?.startsWith("image/")
                )
              : null;
            const isLive = Boolean(sport?.groups.length);

            return (
              <Link
                className="shark-sport-card"
                href={`/${locale}/sports/${entry.slug}`}
                key={entry.slug}
              >
                <div className="shark-sport-photo" style={imageStyle(photo?.url)}>
                  <span className="shark-sport-index">{entry.mark}</span>
                  <span className={isLive ? "shark-status live" : "shark-status"}>
                    {isLive
                      ? locale === "ru" ? "идёт набор" : "qabul ochiq"
                      : locale === "ru" ? "направление" : "yo‘nalish"}
                  </span>
                </div>
                <div className="shark-sport-body">
                  <h3>{locale === "ru" ? sport?.nameRu ?? entry.nameRu : sport?.nameUz ?? entry.nameUz}</h3>
                  <p>
                    {locale === "ru"
                      ? sport?.shortDescriptionRu ?? entry.descriptionRu
                      : sport?.shortDescriptionUz ?? entry.descriptionUz}
                  </p>
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
              <span className="play-dot">▶</span>
              <div>
                <strong>{locale === "ru" ? "Посмотреть, как проходят тренировки" : "Mashg‘ulotlar qanday o‘tishini ko‘ring"}</strong>
                <p>{locale === "ru" ? "Видео можно загрузить в админке → Медиа." : "Videoni admin panel → Media orqali yuklash mumkin."}</p>
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
              <article className="shark-coach-card" key={coach.id}>
                <div className="shark-coach-photo" style={imageStyle(photo?.url)}>
                  {!photo ? <span>{coach.firstName.slice(0, 1)}</span> : null}
                </div>
                <div>
                  <h3>{[coach.firstName, coach.lastName].filter(Boolean).join(" ")}</h3>
                  <p>{sports || (locale === "ru" ? "Тренер SHARK TEAM" : "SHARK TEAM murabbiyi")}</p>
                  {coach.experienceYears ? (
                    <span>{locale === "ru" ? `Опыт ${coach.experienceYears}+ лет` : `Tajriba ${coach.experienceYears}+ yil`}</span>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!data?.coaches.length ? (
            <article className="shark-coach-card shark-empty-card">
              <div>
                <h3>{locale === "ru" ? "Команда тренеров" : "Murabbiylar jamoasi"}</h3>
                <p>{locale === "ru" ? "Тренеры появятся здесь после добавления в админке." : "Murabbiylar admin panelga qo‘shilgach shu yerda ko‘rinadi."}</p>
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
                <div className="shark-branch-photo" style={imageStyle(photo?.url)} />
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
              <h3>{locale === "ru" ? "Филиалы появятся здесь автоматически" : "Filiallar shu yerda avtomatik ko‘rinadi"}</h3>
              <p>{locale === "ru" ? "Достаточно активировать филиал и группу в админке." : "Admin panelda filial va guruhni faollashtirish kifoya."}</p>
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
