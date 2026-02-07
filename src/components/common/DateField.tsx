import { useEffect, useState } from 'react';
import type { CalendarMode } from '@/types/domain';
import {
  BS_MONTH_NAMES,
  formatBsDateParts,
  formatInputDateForMode,
  parseBsDateParts,
  parseInputDateToAd,
} from '@/utils/nepaliDate';

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  mode: CalendarMode;
  onChange: (nextAdIso: string) => void;
  required?: boolean;
}

export function DateField({ id, label, value, mode, onChange, required = false }: DateFieldProps) {
  const [bsYear, setBsYear] = useState('');
  const [bsMonth, setBsMonth] = useState('');
  const [bsDay, setBsDay] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'BS') {
      const bsIso = formatInputDateForMode(value, mode);
      const parts = parseBsDateParts(bsIso);

      if (parts) {
        setBsYear(String(parts.year));
        setBsMonth(String(parts.month).padStart(2, '0'));
        setBsDay(String(parts.day).padStart(2, '0'));
      } else {
        setBsYear('');
        setBsMonth('');
        setBsDay('');
      }
    }
    setError(null);
  }, [mode, value]);

  const applyBsChange = (nextYear: string, nextMonth: string, nextDay: string) => {
    setBsYear(nextYear);
    setBsMonth(nextMonth);
    setBsDay(nextDay);

    if (!nextYear || !nextMonth || !nextDay) {
      setError(null);
      onChange('');
      return;
    }

    if (!/^\d{4}$/.test(nextYear)) {
      setError('Year must be 4 digits.');
      return;
    }

    const bsIso = formatBsDateParts({
      year: Number(nextYear),
      month: Number(nextMonth),
      day: Number(nextDay),
    });
    const adDate = parseInputDateToAd(bsIso, 'BS');

    if (!adDate) {
      setError('Invalid BS date. Adjust year/month/day.');
      return;
    }

    setError(null);
    onChange(adDate);
  };

  const renderInput = () => {
    if (mode === 'AD') {
      return (
        <input
          id={id}
          type="date"
          value={value}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        <input
          id={`${id}-bs-year`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          required={required}
          placeholder="YYYY"
          value={bsYear}
          onChange={(event) => {
            const sanitized = event.target.value.replace(/\D/g, '').slice(0, 4);
            applyBsChange(sanitized, bsMonth, bsDay);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />

        <select
          id={`${id}-bs-month`}
          required={required}
          value={bsMonth}
          onChange={(event) => applyBsChange(bsYear, event.target.value, bsDay)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">Month</option>
          {BS_MONTH_NAMES.map((monthName, index) => {
            const monthValue = String(index + 1).padStart(2, '0');
            return (
              <option key={monthValue} value={monthValue}>
                {monthName}
              </option>
            );
          })}
        </select>

        <select
          id={`${id}-bs-day`}
          required={required}
          value={bsDay}
          onChange={(event) => applyBsChange(bsYear, bsMonth, event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="">Day</option>
          {Array.from({ length: 32 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            return (
              <option key={day} value={day}>
                {day}
              </option>
            );
          })}
        </select>
      </div>
    );
  };

  return (
    <label htmlFor={mode === 'AD' ? id : `${id}-bs-year`} className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {renderInput()}
      {mode === 'BS' ? (
        <p className="text-xs text-slate-500">
          Enter BS year, month, and day (English numerals). Saved as AD in database.
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}
