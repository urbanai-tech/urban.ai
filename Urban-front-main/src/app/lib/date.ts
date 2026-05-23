const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(value: string): Date | null {
  const dateOnly = DATE_ONLY_RE.exec(value);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const monthIndex = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, monthIndex, day);

    if (
      date.getFullYear() === year &&
      date.getMonth() === monthIndex &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateAtLocalOffset(daysOffset: number, from = new Date()): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() + daysOffset);
  return date;
}
