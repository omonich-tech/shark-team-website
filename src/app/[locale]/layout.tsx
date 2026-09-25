import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import {
  PUBLIC_LOCALES,
  isPublicLocale
} from "@/lib/public-i18n";

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!isPublicLocale(locale)) {
    return {};
  }

  return {
    title: {
      default:
        locale === "ru"
          ? "SHARK TEAM — детский баскетбол в Ташкенте"
          : "SHARK TEAM — Toshkentda bolalar basketboli",
      template: "%s | SHARK TEAM"
    },
    description:
      locale === "ru"
        ? "Детская баскетбольная секция SHARK TEAM в Ташкенте."
        : "Toshkentdagi SHARK TEAM bolalar basketbol seksiyasi.",
    alternates: {
      languages: {
        ru: "/ru",
        uz: "/uz"
      }
    }
  };
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!isPublicLocale(locale)) {
    notFound();
  }

  return <PublicShell locale={locale}>{children}</PublicShell>;
}
