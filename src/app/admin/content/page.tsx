import { AdminEntityForm, type AdminField } from "@/components/admin/entity-form";
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
      </section>
    </>
  );
}
