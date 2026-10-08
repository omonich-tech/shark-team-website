import { AdminEntityForm, type AdminField } from "@/components/admin/entity-form";
import {
  ContentSectionsEditor,
  type ContentSectionField
} from "@/components/admin/content-sections-editor";
import { parseContentSections } from "@/lib/content-sections";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusField: AdminField = {
  name: "status",
  label: "Публикация",
  type: "select",
  options: [
    { value: "DRAFT", label: "Draft" },
    { value: "PUBLISHED", label: "Published" },
    { value: "ARCHIVED", label: "Archived" }
  ]
};

const baseFields: AdminField[] = [
  statusField,
  { name: "heroEyebrowRu", label: "Eyebrow RU" },
  { name: "heroEyebrowUz", label: "Eyebrow UZ" },
  { name: "heroTitleRu", label: "Заголовок RU", required: true },
  { name: "heroTitleUz", label: "Заголовок UZ", required: true },
  {
    name: "heroLeadRu",
    label: "Описание RU",
    type: "textarea",
    required: true
  },
  {
    name: "heroLeadUz",
    label: "Описание UZ",
    type: "textarea",
    required: true
  }
];

const seoFields: AdminField[] = [
  { name: "seoTitleRu", label: "SEO title RU" },
  { name: "seoTitleUz", label: "SEO title UZ" },
  {
    name: "seoDescriptionRu",
    label: "SEO description RU",
    type: "textarea"
  },
  {
    name: "seoDescriptionUz",
    label: "SEO description UZ",
    type: "textarea"
  }
];

const homeSectionFields: ContentSectionField[] = [
  { key: "sportsTitleRu", label: "Спорт · заголовок RU" },
  { key: "sportsTitleUz", label: "Спорт · заголовок UZ" },
  { key: "sportsLeadRu", label: "Спорт · описание RU", type: "textarea" },
  { key: "sportsLeadUz", label: "Спорт · описание UZ", type: "textarea" },
  { key: "whyTitleRu", label: "Преимущества · заголовок RU" },
  { key: "whyTitleUz", label: "Преимущества · заголовок UZ" },
  { key: "benefit1TitleRu", label: "Преимущество 1 · название RU" },
  { key: "benefit1TitleUz", label: "Преимущество 1 · название UZ" },
  { key: "benefit1BodyRu", label: "Преимущество 1 · текст RU", type: "textarea" },
  { key: "benefit1BodyUz", label: "Преимущество 1 · текст UZ", type: "textarea" },
  { key: "benefit2TitleRu", label: "Преимущество 2 · название RU" },
  { key: "benefit2TitleUz", label: "Преимущество 2 · название UZ" },
  { key: "benefit2BodyRu", label: "Преимущество 2 · текст RU", type: "textarea" },
  { key: "benefit2BodyUz", label: "Преимущество 2 · текст UZ", type: "textarea" },
  { key: "benefit3TitleRu", label: "Преимущество 3 · название RU" },
  { key: "benefit3TitleUz", label: "Преимущество 3 · название UZ" },
  { key: "benefit3BodyRu", label: "Преимущество 3 · текст RU", type: "textarea" },
  { key: "benefit3BodyUz", label: "Преимущество 3 · текст UZ", type: "textarea" },
  { key: "benefit4TitleRu", label: "Преимущество 4 · название RU" },
  { key: "benefit4TitleUz", label: "Преимущество 4 · название UZ" },
  { key: "benefit4BodyRu", label: "Преимущество 4 · текст RU", type: "textarea" },
  { key: "benefit4BodyUz", label: "Преимущество 4 · текст UZ", type: "textarea" },
  { key: "coachesTitleRu", label: "Тренеры · заголовок RU" },
  { key: "coachesTitleUz", label: "Тренеры · заголовок UZ" },
  { key: "branchesTitleRu", label: "Филиалы · заголовок RU" },
  { key: "branchesTitleUz", label: "Филиалы · заголовок UZ" },
  { key: "trialTitleRu", label: "Пробное · заголовок RU" },
  { key: "trialTitleUz", label: "Пробное · заголовок UZ" },
  { key: "trial1TitleRu", label: "Шаг 1 · название RU" },
  { key: "trial1TitleUz", label: "Шаг 1 · название UZ" },
  { key: "trial1BodyRu", label: "Шаг 1 · текст RU", type: "textarea" },
  { key: "trial1BodyUz", label: "Шаг 1 · текст UZ", type: "textarea" },
  { key: "trial2TitleRu", label: "Шаг 2 · название RU" },
  { key: "trial2TitleUz", label: "Шаг 2 · название UZ" },
  { key: "trial2BodyRu", label: "Шаг 2 · текст RU", type: "textarea" },
  { key: "trial2BodyUz", label: "Шаг 2 · текст UZ", type: "textarea" },
  { key: "trial3TitleRu", label: "Шаг 3 · название RU" },
  { key: "trial3TitleUz", label: "Шаг 3 · название UZ" },
  { key: "trial3BodyRu", label: "Шаг 3 · текст RU", type: "textarea" },
  { key: "trial3BodyUz", label: "Шаг 3 · текст UZ", type: "textarea" },
  { key: "faqTitleRu", label: "FAQ · заголовок RU" },
  { key: "faqTitleUz", label: "FAQ · заголовок UZ" },
  { key: "ctaTitleRu", label: "Финальный CTA · заголовок RU" },
  { key: "ctaTitleUz", label: "Финальный CTA · заголовок UZ" },
  { key: "ctaLeadRu", label: "Финальный CTA · текст RU", type: "textarea" },
  { key: "ctaLeadUz", label: "Финальный CTA · текст UZ", type: "textarea" }
];

const aboutSectionFields: ContentSectionField[] = [
  { key: "storyEyebrowRu", label: "История · eyebrow RU" },
  { key: "storyEyebrowUz", label: "История · eyebrow UZ" },
  { key: "storyTitleRu", label: "История · заголовок RU" },
  { key: "storyTitleUz", label: "История · заголовок UZ" },
  { key: "principlesEyebrowRu", label: "Принципы · eyebrow RU" },
  { key: "principlesEyebrowUz", label: "Принципы · eyebrow UZ" },
  { key: "principlesTitleRu", label: "Принципы · заголовок RU" },
  { key: "principlesTitleUz", label: "Принципы · заголовок UZ" },
  { key: "principle1TitleRu", label: "Принцип 1 · название RU" },
  { key: "principle1TitleUz", label: "Принцип 1 · название UZ" },
  { key: "principle1BodyRu", label: "Принцип 1 · текст RU", type: "textarea" },
  { key: "principle1BodyUz", label: "Принцип 1 · текст UZ", type: "textarea" },
  { key: "principle2TitleRu", label: "Принцип 2 · название RU" },
  { key: "principle2TitleUz", label: "Принцип 2 · название UZ" },
  { key: "principle2BodyRu", label: "Принцип 2 · текст RU", type: "textarea" },
  { key: "principle2BodyUz", label: "Принцип 2 · текст UZ", type: "textarea" },
  { key: "principle3TitleRu", label: "Принцип 3 · название RU" },
  { key: "principle3TitleUz", label: "Принцип 3 · название UZ" },
  { key: "principle3BodyRu", label: "Принцип 3 · текст RU", type: "textarea" },
  { key: "principle3BodyUz", label: "Принцип 3 · текст UZ", type: "textarea" },
  { key: "principle4TitleRu", label: "Принцип 4 · название RU" },
  { key: "principle4TitleUz", label: "Принцип 4 · название UZ" },
  { key: "principle4BodyRu", label: "Принцип 4 · текст RU", type: "textarea" },
  { key: "principle4BodyUz", label: "Принцип 4 · текст UZ", type: "textarea" },
  { key: "ctaTitleRu", label: "Финальный CTA · заголовок RU" },
  { key: "ctaTitleUz", label: "Финальный CTA · заголовок UZ" },
  { key: "ctaLeadRu", label: "Финальный CTA · текст RU", type: "textarea" },
  { key: "ctaLeadUz", label: "Финальный CTA · текст UZ", type: "textarea" }
];

const contactsSectionFields: ContentSectionField[] = [
  { key: "channelsEyebrowRu", label: "Каналы · eyebrow RU" },
  { key: "channelsEyebrowUz", label: "Каналы · eyebrow UZ" },
  { key: "channelsTitleRu", label: "Каналы · заголовок RU" },
  { key: "channelsTitleUz", label: "Каналы · заголовок UZ" },
  { key: "branchesEyebrowRu", label: "Филиалы · eyebrow RU" },
  { key: "branchesEyebrowUz", label: "Филиалы · eyebrow UZ" },
  { key: "branchesTitleRu", label: "Филиалы · заголовок RU" },
  { key: "branchesTitleUz", label: "Филиалы · заголовок UZ" },
  { key: "ctaTitleRu", label: "Финальный CTA · заголовок RU" },
  { key: "ctaTitleUz", label: "Финальный CTA · заголовок UZ" },
  { key: "ctaLeadRu", label: "Финальный CTA · текст RU", type: "textarea" },
  { key: "ctaLeadUz", label: "Финальный CTA · текст UZ", type: "textarea" }
];

function values(content: {
  status: string;
  heroEyebrowRu: string | null;
  heroEyebrowUz: string | null;
  heroTitleRu: string | null;
  heroTitleUz: string | null;
  heroLeadRu: string | null;
  heroLeadUz: string | null;
  bodyRu: string | null;
  bodyUz: string | null;
  contactPhone: string | null;
  contactTelegram: string | null;
  contactInstagram: string | null;
  contactEmail: string | null;
  contactHoursRu: string | null;
  contactHoursUz: string | null;
  seoTitleRu: string | null;
  seoTitleUz: string | null;
  seoDescriptionRu: string | null;
  seoDescriptionUz: string | null;
}) {
  return {
    status: content.status,
    heroEyebrowRu: content.heroEyebrowRu,
    heroEyebrowUz: content.heroEyebrowUz,
    heroTitleRu: content.heroTitleRu,
    heroTitleUz: content.heroTitleUz,
    heroLeadRu: content.heroLeadRu,
    heroLeadUz: content.heroLeadUz,
    bodyRu: content.bodyRu,
    bodyUz: content.bodyUz,
    contactPhone: content.contactPhone,
    contactTelegram: content.contactTelegram,
    contactInstagram: content.contactInstagram,
    contactEmail: content.contactEmail,
    contactHoursRu: content.contactHoursRu,
    contactHoursUz: content.contactHoursUz,
    seoTitleRu: content.seoTitleRu,
    seoTitleUz: content.seoTitleUz,
    seoDescriptionRu: content.seoDescriptionRu,
    seoDescriptionUz: content.seoDescriptionUz
  };
}

export default async function AdminContentPage() {
  const prisma = getPrisma();
  const pages = await prisma.contentPage.findMany({
    where: { slug: { in: ["home", "about", "contacts"] } }
  });

  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const home = bySlug.get("home");
  const about = bySlug.get("about");
  const contacts = bySlug.get("contacts");

  if (!home || !about || !contacts) {
    throw new Error("Core public content pages are not initialized");
  }

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>Контент сайта RU / UZ</h1>
          <p className="admin-page-note">
            Главная, «О нас» и «Контакты» управляются здесь. Филиалы,
            тренеры, виды спорта и медиа остаются в своих разделах.
          </p>
        </div>
        <span className="admin-count">3 страницы</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Главная</h2>
          <p>Первый экран и SEO главной страницы.</p>
        </div>
        <AdminEntityForm
          endpoint="/api/admin/content/home"
          fields={[...baseFields, ...seoFields]}
          initialValues={values(home)}
        />
        <ContentSectionsEditor
          endpoint="/api/admin/content/home"
          title="Секции главной"
          description="Преимущества, шаги пробного, заголовки секций и финальный CTA."
          fields={homeSectionFields}
          initialSections={parseContentSections(home.sectionsJson)}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>О нас</h2>
          <p>
            Тексты о подходе SHARK TEAM. Цифры на странице считаются
            автоматически из активных данных.
          </p>
        </div>
        <AdminEntityForm
          endpoint="/api/admin/content/about"
          fields={[
            ...baseFields,
            {
              name: "bodyRu",
              label: "Основной текст RU",
              type: "textarea",
              required: true
            },
            {
              name: "bodyUz",
              label: "Основной текст UZ",
              type: "textarea",
              required: true
            },
            ...seoFields
          ]}
          initialValues={values(about)}
        />
        <ContentSectionsEditor
          endpoint="/api/admin/content/about"
          title="Секции «О нас»"
          description="Заголовки истории, принципы и финальный CTA."
          fields={aboutSectionFields}
          initialSections={parseContentSections(about.sectionsJson)}
        />
      </section>

      <section className="admin-panel admin-editor-panel">
        <div className="admin-panel-head">
          <h2>Контакты</h2>
          <p>
            Общие каналы связи. Адреса, телефоны и часы работы конкретных
            филиалов берутся из раздела «Филиалы».
          </p>
        </div>
        <AdminEntityForm
          endpoint="/api/admin/content/contacts"
          fields={[
            ...baseFields,
            {
              name: "bodyRu",
              label: "Текст страницы RU",
              type: "textarea"
            },
            {
              name: "bodyUz",
              label: "Текст страницы UZ",
              type: "textarea"
            },
            { name: "contactPhone", label: "Общий телефон" },
            {
              name: "contactTelegram",
              label: "Telegram URL",
              placeholder: "https://t.me/..."
            },
            {
              name: "contactInstagram",
              label: "Instagram URL",
              placeholder: "https://instagram.com/..."
            },
            { name: "contactEmail", label: "Email" },
            { name: "contactHoursRu", label: "Часы связи RU" },
            { name: "contactHoursUz", label: "Часы связи UZ" },
            ...seoFields
          ]}
          initialValues={values(contacts)}
        />
        <ContentSectionsEditor
          endpoint="/api/admin/content/contacts"
          title="Секции контактов"
          description="Заголовки каналов, филиалов и финального CTA."
          fields={contactsSectionFields}
          initialSections={parseContentSections(contacts.sectionsJson)}
        />
      </section>
    </>
  );
}
