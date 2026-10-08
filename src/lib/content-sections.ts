import type { PublicLocale } from "@/lib/public-i18n";

export type ContentSections = Record<string, string>;

export function parseContentSections(value: unknown): ContentSections {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: ContentSections = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }

  return result;
}

export function sectionText(
  sections: ContentSections,
  key: string,
  locale: PublicLocale,
  fallback: string
) {
  const localizedKey = key + (locale === "ru" ? "Ru" : "Uz");
  const value = sections[localizedKey]?.trim();
  return value || fallback;
}
