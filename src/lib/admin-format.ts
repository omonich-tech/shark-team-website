export function formatAdminDate(value: Date | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function formatAdminMoney(amount: number, currency = "UZS") {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ${currency}`;
}
