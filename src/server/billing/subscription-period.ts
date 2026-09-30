export function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addSubscriptionMonth(value: Date) {
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const targetMonth = month + 1;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  const day = Math.min(
    value.getUTCDate(),
    daysInUtcMonth(targetYear, normalizedMonth)
  );

  return new Date(
    Date.UTC(
      targetYear,
      normalizedMonth,
      day,
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds()
    )
  );
}

export function subscriptionGraceDays() {
  const configured = Number(process.env.SUBSCRIPTION_GRACE_DAYS ?? "3");

  return Number.isInteger(configured) && configured >= 0 && configured <= 30
    ? configured
    : 3;
}

export function subscriptionReminderDays() {
  const configured = Number(
    process.env.SUBSCRIPTION_RENEWAL_REMINDER_DAYS ?? "3"
  );

  return Number.isInteger(configured) && configured >= 0 && configured <= 30
    ? configured
    : 3;
}

export function addDays(value: Date, amount: number) {
  return new Date(value.getTime() + amount * 24 * 60 * 60 * 1000);
}
