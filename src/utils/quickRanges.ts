const KATHMANDU_TIME_ZONE = 'Asia/Kathmandu';

export type QuickRangeValue = '' | 'lastWeek' | 'lastMonth' | 'nextWeek' | 'nextMonth' | 'custom';

interface KathmanduDateParts {
  year: number;
  month: number;
  day: number;
}

export interface QuickRangeDates {
  startDate: string;
  endDate: string;
}

function getKathmanduDateParts(referenceDate: Date = new Date()): KathmanduDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KATHMANDU_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referenceDate);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function formatIsoDate(parts: KathmanduDateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getKathmanduTodayIso(referenceDate: Date = new Date()): string {
  return formatIsoDate(getKathmanduDateParts(referenceDate));
}

export function getQuickRangeDates(
  quickRange: Exclude<QuickRangeValue, '' | 'custom'>,
  referenceDate: Date = new Date(),
): QuickRangeDates {
  const todayIso = getKathmanduTodayIso(referenceDate);

  switch (quickRange) {
    case 'lastWeek':
      return {
        startDate: addDaysToIsoDate(todayIso, -7),
        endDate: todayIso,
      };
    case 'lastMonth':
      return {
        startDate: addDaysToIsoDate(todayIso, -30),
        endDate: todayIso,
      };
    case 'nextWeek':
      return {
        startDate: todayIso,
        endDate: addDaysToIsoDate(todayIso, 7),
      };
    case 'nextMonth':
      return {
        startDate: todayIso,
        endDate: addDaysToIsoDate(todayIso, 30),
      };
  }
}

