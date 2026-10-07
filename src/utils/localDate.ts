export type LocalDate = string;

const pad2 = (value: number) => String(value).padStart(2, '0');

export function toLocalDate(date: Date): LocalDate {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-');
}

export function todayLocalDate(): LocalDate {
  return toLocalDate(new Date());
}

export function fromLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return new Date(NaN);
  }

  // Noon local time avoids date rollover around DST/timezone boundaries.
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatLocalDate(
  value: LocalDate | null,
  emptyText = 'Select date',
): string {
  if (!value) return emptyText;

  const date = fromLocalDate(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
