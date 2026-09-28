import { FaqEditor } from "@/components/admin/faq-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const prisma = getPrisma();

  const items = await prisma.faqItem.findMany({
    where: {
      branchId: "BR-SCHOOL-117-01",
      sportId: "SP-BASKETBALL-01"
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">SITE</p>
          <h1>FAQ</h1>
        </div>
        <span className="admin-count">{items.length} вопросов</span>
      </div>

      <FaqEditor
        branchId="BR-SCHOOL-117-01"
        sportId="SP-BASKETBALL-01"
        initialItems={items.map((item) => ({
          id: item.id,
          status: item.status,
          questionRu: item.questionRu,
          questionUz: item.questionUz,
          answerRu: item.answerRu,
          answerUz: item.answerUz,
          sortOrder: item.sortOrder
        }))}
      />
    </>
  );
}
