export function getTodayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function formatShortDate(date: Date) {
  return `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}`;
}

export function formatDisplayDate(date: Date) {
  return `${formatShortDate(date)}/${date.getFullYear()}`;
}

export function eachDayOfInterval(startDate: Date, endDate: Date) {
  const days: Date[] = [];
  const cursor = new Date(startDate);
  const lastDay = new Date(endDate);

  cursor.setHours(0, 0, 0, 0);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastDay.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function getLastDaysBounds(days: number, now = new Date()) {
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : 1;
  const { start, end } = getTodayBounds(now);

  start.setDate(start.getDate() - (safeDays - 1));

  return { start, end };
}

export function parseOptionalDate(value?: string | null, edge: "start" | "end" = "start") {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (edge === "end") {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatTimeAgo(input: Date | string, now: Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = date.getTime() - now.getTime();
  const diffAbs = Math.abs(diffMs);
  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(diffMs / (60 * 1000));
  const hours = Math.round(diffMs / (60 * 60 * 1000));
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffAbs < 60 * 1000) {
    return relativeTimeFormatter.format(seconds, "second");
  }

  if (diffAbs < 60 * 60 * 1000) {
    return relativeTimeFormatter.format(minutes, "minute");
  }

  if (diffAbs < 24 * 60 * 60 * 1000) {
    return relativeTimeFormatter.format(hours, "hour");
  }

  if (diffAbs < 30 * 24 * 60 * 60 * 1000) {
    return relativeTimeFormatter.format(days, "day");
  }

  return formatDisplayDate(date);
}
