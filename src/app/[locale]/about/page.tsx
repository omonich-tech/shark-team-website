import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";
import {
  parseContentSections,
  sectionText
} from "@/lib/content-sections";
import { tryGetPublishedContentPage } from "@/server/public-data/content-page";
import { tryGetPublicHomeData } from "@/server/public-data/home";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isPublicLocale(locale)) return {};

  const page = await tryGetPublishedContentPage("about");
  if (!page) return {};

  return {
    title:
      (locale === "ru"
        ? page.content.seoTitleRu
        : page.content.seoTitleUz) ??
      (locale === "ru" ? "О SHARK TEAM" : "SHARK TEAM haqida"),
    description:
      (locale === "ru"
        ? page.content.seoDescriptionRu
        : page.content.seoDescriptionUz) ??
      (locale === "ru"
        ? page.content.heroLeadRu
        : page.content.heroLeadUz) ??
      undefined
  };
}

export default async function AboutPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const [page, data] = await Promise.all([
    tryGetPublishedContentPage("about"),
    tryGetPublicHomeData()
  ]);

  if (!page) notFound();

  const heroImage =
    page.media.find(
      (item) => item.isPrimary && item.contentType?.startsWith("image/")
    ) ??
    page.media.find((item) => item.contentType?.startsWith("image/")) ??
    null;

  const eyebrow =
    (locale === "ru"
      ? page.content.heroEyebrowRu
      : page.content.heroEyebrowUz) ?? "SHARK TEAM";
  const title =
    (locale === "ru"
      ? page.content.heroTitleRu
      : page.content.heroTitleUz) ?? "SHARK TEAM";
  const lead =
    (locale === "ru"
      ? page.content.heroLeadRu
      : page.content.heroLeadUz) ?? "";
  const body =
    (locale === "ru" ? page.content.bodyRu : page.content.bodyUz) ?? "";
  const sections = parseContentSections(page.content.sectionsJson);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  const activeGroups =
    data?.sports.reduce((total, sport) => total + sport.groups.length, 0) ?? 0;

  const stats =
    locale === "ru"
      ? [
          [String(data?.sports.length ?? 0), "видов спорта"],
          [String(data?.branches.length ?? 0), "активных филиалов"],
          [String(data?.coaches.length ?? 0), "тренеров"],
          [String(activeGroups), "активных групп"]
        ]
      : [
          [String(data?.sports.length ?? 0), "sport turi"],
          [String(data?.branches.length ?? 0), "faol filial"],
          [String(data?.coaches.length ?? 0), "murabbiy"],
          [String(activeGroups), "faol guruh"]
        ];

  const principleFallback =
    locale === "ru"
      ? [
          ["Развитие", "Не только техника спорта, но и координация, физическая база, уверенность и самостоятельность."],
          ["Дисциплина", "Регулярность, понятные правила и уважение к тренеру, команде и собственному прогрессу."],
          ["Команда", "Ребёнок тренируется среди сверстников и учится взаимодействовать, поддерживать и брать ответственность."],
          ["Безопасная среда", "Возрастные группы, контролируемая нагрузка и прозрачная коммуникация с родителем."]
        ]
      : [
          ["Rivojlanish", "Faqat sport texnikasi emas, balki koordinatsiya, jismoniy baza, ishonch va mustaqillik."],
          ["Intizom", "Muntazamlik, tushunarli qoidalar va murabbiy, jamoa hamda o‘z rivojlanishiga hurmat."],
          ["Jamoa", "Bola tengdoshlari bilan mashq qiladi, hamkorlik, qo‘llab-quvvatlash va mas’uliyatni o‘rganadi."],
          ["Xavfsiz muhit", "Yosh guruhlari, nazorat qilinadigan yuklama va ota-ona bilan ochiq muloqot."]
        ];

  const principles = principleFallback.map(([title, description], index) => [
    sectionText(sections, `principle${index + 1}Title`, locale, title),
    sectionText(sections, `principle${index + 1}Body`, locale, description)
  ]);

  const storyEyebrow = sectionText(
    sections,
    "storyEyebrow",
    locale,
    locale === "ru" ? "НАШ ПОДХОД" : "BIZNING YONDASHUV"
  );
  const storyTitle = sectionText(
    sections,
    "storyTitle",
    locale,
    locale === "ru"
      ? "Среда, в которой ребёнок растёт через спорт"
      : "Bola sport orqali rivojlanadigan muhit"
  );
  const principlesEyebrow = sectionText(
    sections,
    "principlesEyebrow",
    locale,
    locale === "ru" ? "ПРИНЦИПЫ" : "TAMOYILLAR"
  );
  const principlesTitle = sectionText(
    sections,
    "principlesTitle",
    locale,
    locale === "ru"
      ? "Что мы хотим дать ребёнку"
      : "Bolaga nima berishni istaymiz"
  );
  const ctaTitle = sectionText(
    sections,
    "ctaTitle",
    locale,
    locale === "ru"
      ? "Найдите спорт, который подойдёт вашему ребёнку"
      : "Farzandingizga mos sport turini toping"
  );
  const ctaLead = sectionText(
    sections,
    "ctaLead",
    locale,
    locale === "ru"
      ? "Выберите направление, филиал и удобную дату пробного занятия."
      : "Yo‘nalish, filial va qulay sinov sanasini tanlang."
  );

  return (
    <main className="page-main">
      <section className="about-hero">
        <div className="about-hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lead">{lead}</p>
          <div className="hero-actions">
            <Link className="button primary" href={`/${locale}/sports`}>
              {locale === "ru" ? "Выбрать вид спорта" : "Sport turini tanlash"}
            </Link>
            <Link className="button secondary" href={`/${locale}/trial`}>
              {locale === "ru" ? "Записаться на пробное" : "Sinovga yozilish"}
            </Link>
          </div>
        </div>
        <div
          className={heroImage ? "about-hero-media has-photo" : "about-hero-media"}
          style={
            heroImage
              ? { backgroundImage: `url("${heroImage.url}")` }
              : undefined
          }
          role={heroImage ? "img" : undefined}
          aria-label={
            heroImage
              ? (locale === "ru" ? heroImage.altRu : heroImage.altUz) ??
                "SHARK TEAM"
              : undefined
          }
        >
          <span>SHARK</span>
        </div>
      </section>

      <section className="content-section about-story-section">
        <div className="section-heading shark-section-heading">
          <div>
            <p className="eyebrow">{storyEyebrow}</p>
            <h2>{storyTitle}</h2>
          </div>
        </div>

        <div className="about-story-grid">
          <div className="about-story-copy">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="about-stats-grid">
            {stats.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">{principlesEyebrow}</p>
          <h2>{principlesTitle}</h2>
        </div>
        <div className="about-principles-grid">
          {principles.map(([name, description], index) => (
            <article key={name}>
              <span>0{index + 1}</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shark-final-cta">
        <div>
          <p className="eyebrow">SHARK TEAM</p>
          <h2>{ctaTitle}</h2>
          <p>{ctaLead}</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href={`/${locale}/trial`}>
            {locale === "ru" ? "Записаться на пробное →" : "Sinovga yozilish →"}
          </Link>
        </div>
      </section>
    </main>
  );
}
