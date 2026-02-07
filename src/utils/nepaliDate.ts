import NepaliDate from 'nepali-date-converter';
import type { CalendarMode } from '@/types/domain';
import { formatAdDate, fromIsoDate, toIsoDate } from '@/utils/date';

const BS_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function formatDateForMode(adDateIso: string, mode: CalendarMode): string {
  if (!adDateIso) return '';
  return mode === 'BS' ? adToBs(adDateIso) : formatAdDate(adDateIso);
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
