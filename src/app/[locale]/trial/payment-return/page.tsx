import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { isPublicLocale } from "@/lib/public-i18n";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  const { order } = await searchParams;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  let status: string | null = null;

  if (order) {
    try {
      const prisma = getPrisma();
      const payment = await prisma.payment.findUnique({
        where: { id: order },
        select: { status: true }
      });
      status = payment?.status ?? null;
    } catch {
      status = null;
    }
  }

  const paid = status === "PAID";

  return (
    <main className="page-main">
      <section className="service-state">
        <p className="eyebrow">PAYME · SHARK TEAM</p>
        <h1>
          {paid
            ? locale === "ru"
              ? "Оплата подтверждена"
              : "To‘lov tasdiqlandi"
            : locale === "ru"
              ? "Проверяем оплату"
              : "To‘lov tekshirilmoqda"}
        </h1>
        <p>
          {paid
            ? locale === "ru"
              ? "Пробное занятие подтверждено. Бронь закреплена за ребёнком."
              : "Sinov mashg‘uloti tasdiqlandi. Bron bola uchun saqlandi."
            : locale === "ru"
              ? "Если вы уже завершили оплату в Payme, обновите эту страницу через несколько секунд."
              : "Agar Payme orqali to‘lovni yakunlagan bo‘lsangiz, bir necha soniyadan keyin sahifani yangilang."}
        </p>
        <div className="hero-actions">
          <Link className="button primary" href={`/${locale}/trial/payment-return?order=${order ?? ""}`}>
            {locale === "ru" ? "Обновить статус" : "Holatni yangilash"}
          </Link>
          <Link className="button secondary dark" href={`/${locale}`}>
            {locale === "ru" ? "На главную" : "Bosh sahifaga"}
          </Link>
        </div>
      </section>
    </main>
  );
}
