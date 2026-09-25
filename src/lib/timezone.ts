function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

export function localDateTimeToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string
) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = zonedParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );

    const delta = targetAsUtc - observedAsUtc;

    if (delta === 0) {
      break;
    }

    guess += delta;
  }

  return new Date(guess);
}

function addCalendarDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

export function dayRangeInTimeZone(
  now: Date,
  timeZone: string
) {
  const dateKey = dateKeyInTimeZone(now, timeZone);
  const nextDateKey = addCalendarDays(dateKey, 1);

  return {
    dateKey,
    start: localDateTimeToUtc(dateKey, 0, 0, timeZone),
    end: localDateTimeToUtc(nextDateKey, 0, 0, timeZone)
  };
}
