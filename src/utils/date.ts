export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatAdDate(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function getMonthGrid(referenceDate: Date): Date[] {
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function formatMonthLabel(referenceDate: Date): string {
  return referenceDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(referenceDate: Date, delta: number): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + delta, 1);
}

export function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
