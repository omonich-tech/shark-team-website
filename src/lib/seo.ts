import type { Metadata } from "next";
import type { PublicLocale } from "@/lib/public-i18n";

export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function absoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : "/" + path;
  return appUrl() + normalized;
}

export function localizedPath(locale: PublicLocale, path = "") {
  const normalized = path
    ? path.startsWith("/")
      ? path
      : "/" + path
    : "";
  return `/${locale}${normalized}`;
}

export function buildPublicMetadata({
  locale,
  path,
  title,
  description,
  images = [],
  absoluteTitle = false,
  noIndex = false
}: {
  locale: PublicLocale;
  path?: string;
  title: string;
  description?: string | null;
  images?: string[];
  absoluteTitle?: boolean;
  noIndex?: boolean;
}): Metadata {
  const ruPath = localizedPath("ru", path);
  const uzPath = localizedPath("uz", path);
  const canonicalPath = localizedPath(locale, path);
  const canonical = absoluteUrl(canonicalPath);
  const safeDescription = description?.trim() || undefined;
  const ogImages = images
    .filter(Boolean)
    .slice(0, 4)
    .map((url) => ({
      url,
      alt: title
    }));

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: safeDescription,
    alternates: {
      canonical,
      languages: {
        ru: absoluteUrl(ruPath),
        uz: absoluteUrl(uzPath),
        "x-default": absoluteUrl(ruPath)
      }
    },
    openGraph: {
      type: "website",
      siteName: "SHARK TEAM",
      title,
      description: safeDescription,
      url: canonical,
      locale: locale === "ru" ? "ru_RU" : "uz_UZ",
      alternateLocale: [locale === "ru" ? "uz_UZ" : "ru_RU"],
      images: ogImages.length ? ogImages : undefined
    },
    twitter: {
      card: ogImages.length ? "summary_large_image" : "summary",
      title,
      description: safeDescription,
      images: ogImages.length ? ogImages.map((image) => image.url) : undefined
    },
    robots: noIndex
      ? {
          index: false,
          follow: false
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        }
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function faqJsonLd(
  items: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}
