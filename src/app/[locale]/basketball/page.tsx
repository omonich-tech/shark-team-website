import { notFound, permanentRedirect } from "next/navigation";
import { isPublicLocale } from "@/lib/public-i18n";

export default async function LegacyBasketballPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();
  permanentRedirect(`/${locale}/sports/basketball`);
}
