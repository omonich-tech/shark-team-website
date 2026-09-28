import { AdminEntityForm } from "@/components/admin/entity-form";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const prisma = getPrisma();
  const content = await prisma.contentPage.findUniqueOrThrow({
    where: { slug: "home" }
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>Главная RU / UZ</h1>
        </div>
        <span className="admin-count">{content.status}</span>
      </div>

      <section className="admin-panel admin-editor-panel">
        <AdminEntityForm
          endpoint="/api/admin/content/home"
          fields={[
            {
              name: "status",
              label: "Публикация",
              type: "select",
              options: [
                { value: "DRAFT", label: "Draft" },
                { value: "PUBLISHED", label: "Published" },
                { value: "ARCHIVED", label: "Archived" }
              ]
            },
            { name: "heroEyebrowRu", label: "Hero eyebrow RU" },
            { name: "heroEyebrowUz", label: "Hero eyebrow UZ" },
            { name: "heroTitleRu", label: "Hero title RU", required: true },
            { name: "heroTitleUz", label: "Hero title UZ", required: true },
            {
              name: "heroLeadRu",
              label: "Hero описание RU",
              type: "textarea",
              required: true
            },
            {
              name: "heroLeadUz",
              label: "Hero описание UZ",
              type: "textarea",
              required: true
            },
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
          ]}
          initialValues={{
            status: content.status,
            heroEyebrowRu: content.heroEyebrowRu,
            heroEyebrowUz: content.heroEyebrowUz,
            heroTitleRu: content.heroTitleRu,
            heroTitleUz: content.heroTitleUz,
            heroLeadRu: content.heroLeadRu,
            heroLeadUz: content.heroLeadUz,
            seoTitleRu: content.seoTitleRu,
            seoTitleUz: content.seoTitleUz,
            seoDescriptionRu: content.seoDescriptionRu,
            seoDescriptionUz: content.seoDescriptionUz
          }}
        />
      </section>
    </>
  );
}
