export function wibDayStart(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  const date = new Date(`${dateOnly}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function wibDayEnd(dateOnly: string): string | null {
  const start = wibDayStart(dateOnly);
  if (!start) return null;
  return new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

export function todayWibRange(): { start: string; end: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const today = formatter.format(new Date());
  return {
    start: wibDayStart(today) ?? new Date().toISOString(),
    end: wibDayEnd(today) ?? new Date().toISOString(),
  };
}
