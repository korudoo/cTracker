import NepaliDate from 'nepali-date-converter';
import type { CalendarMode } from '@/types/domain';
import { formatAdDate, fromIsoDate, toIsoDate } from '@/utils/date';

const BS_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const BS_MONTH_NAMES = [
  'Baisakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export interface BsDateParts {
  year: number;
  month: number;
  day: number;
}

type NepaliDateInstance = {
  format?: (format: string) => string;
  getEnglishDate?: () => Date;
  toJsDate?: () => Date;
};

function buildNepaliDate(value: Date | string): NepaliDateInstance {
  const Constructor = NepaliDate as unknown as { new (input: Date | string): NepaliDateInstance };
  return new Constructor(value);
}

export function adToBs(adDateIso: string): string {
  if (!adDateIso) return '';

  try {
    const adDate = fromIsoDate(adDateIso);
    const nepaliDate = buildNepaliDate(adDate);
    const bs = nepaliDate.format?.('YYYY-MM-DD');
    return bs && BS_PATTERN.test(bs) ? bs : adDateIso;
  } catch {
    return adDateIso;
  }
}

export function bsToAd(bsDate: string): string | null {
  if (!bsDate || !BS_PATTERN.test(bsDate)) {
    return null;
  }

  try {
    const nepaliDate = buildNepaliDate(bsDate);
    const englishDate = nepaliDate.getEnglishDate?.() ?? nepaliDate.toJsDate?.();

    if (!(englishDate instanceof Date) || Number.isNaN(englishDate.getTime())) {
      return null;
    }

    return toIsoDate(englishDate);
  } catch {
    return null;
  }
}

export function parseBsDateParts(bsDate: string): BsDateParts | null {
  const match = bsDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > 32) {
    return null;
  }

  return { year, month, day };
}

export function formatBsDateParts(parts: BsDateParts): string {
  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBsDatePartsFromAd(adDateIso: string): BsDateParts | null {
  const bsIso = adToBs(adDateIso);
  return parseBsDateParts(bsIso);
}

export function getBsMonthName(month: number): string | null {
  if (month < 1 || month > 12) {
    return null;
  }
  return BS_MONTH_NAMES[month - 1];
}

export function formatBsDateReadableFromAd(adDateIso: string): string {
  const parts = getBsDatePartsFromAd(adDateIso);
  if (!parts) {
    return '';
  }

  const monthName = getBsMonthName(parts.month);
  if (!monthName) {
    return '';
  }

  return `${parts.day} ${monthName} ${parts.year} BS`;
}

export function formatBsMonthYearFromAd(adDateIso: string): string {
  const parts = getBsDatePartsFromAd(adDateIso);
  if (!parts) {
    return '';
  }

  const monthName = getBsMonthName(parts.month);
  if (!monthName) {
    return '';
  }

  return `${monthName} ${parts.year} BS`;
}

export function formatAdDateReadable(adDateIso: string): string {
  if (!AD_PATTERN.test(adDateIso)) {
    return '';
  }

  const date = fromIsoDate(adDateIso);
  const day = String(date.getDate());
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = String(date.getFullYear());
  return `${day} ${month} ${year} AD`;
}

export function formatDualDate(adDateIso: string): string {
  const ad = formatAdDateReadable(adDateIso);
  const bs = formatBsDateReadableFromAd(adDateIso);

  if (!ad && !bs) {
    return '';
  }
  if (!bs) {
    return ad;
  }
  if (!ad) {
    return bs;
  }

  return `${ad} / ${bs}`;
}

export function formatDateForMode(adDateIso: string, mode: CalendarMode): string {
  if (!adDateIso) return '';
  return mode === 'BS' ? formatBsDateReadableFromAd(adDateIso) || adToBs(adDateIso) : formatAdDate(adDateIso);
}

export function formatInputDateForMode(adDateIso: string, mode: CalendarMode): string {
  if (!adDateIso) return '';
  return mode === 'BS' ? adToBs(adDateIso) : adDateIso;
}

export function parseInputDateToAd(inputDate: string, mode: CalendarMode): string | null {
  if (!inputDate) return null;
  if (mode === 'AD') {
    return /^\d{4}-\d{2}-\d{2}$/.test(inputDate) ? inputDate : null;
  }
  return bsToAd(inputDate);
}
