export const PUBLIC_LOCALES = ["ru", "uz"] as const;

export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export function isPublicLocale(value: string): value is PublicLocale {
  return PUBLIC_LOCALES.includes(value as PublicLocale);
}

export function pickLocalized(
  locale: PublicLocale,
  value: { ru: string | null; uz: string | null }
) {
  return locale === "uz" ? value.uz ?? value.ru ?? "" : value.ru ?? value.uz ?? "";
}

export function formatUzs(amount: number, locale: PublicLocale) {
  const formatted = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU").format(amount);
  return `${formatted} UZS`;
}

const weekdays = {
  MONDAY: { ru: "Пн", uz: "Du" },
  TUESDAY: { ru: "Вт", uz: "Se" },
  WEDNESDAY: { ru: "Ср", uz: "Cho" },
  THURSDAY: { ru: "Чт", uz: "Pa" },
  FRIDAY: { ru: "Пт", uz: "Ju" },
  SATURDAY: { ru: "Сб", uz: "Sha" },
  SUNDAY: { ru: "Вс", uz: "Ya" }
} as const;

export function weekdayLabel(
  weekday: keyof typeof weekdays,
  locale: PublicLocale
) {
  return weekdays[weekday][locale];
}
